import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  SafeAreaView, ScrollView, Dimensions, StatusBar,
  Platform, RefreshControl, Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { io } from 'socket.io-client';
import { SOCKET_URL, logout, getStops, getToken } from '../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PRIMARY = '#1A73E8';

const toRad = v => (v * Math.PI) / 180;
const getDistKm = (a, b, c, d) => {
  const R = 6371, dL = toRad(c-a), dN = toRad(d-b);
  const x = Math.sin(dL/2)**2 + Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dN/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
};
const getETA = (km, spd) => {
  if (!spd || spd < 2) return '-- min';
  const m = Math.round((km/spd)*60);
  return m < 1 ? '< 1 min' : `${m} min`;
};

const buildMapHtml = (lat, lng, stops) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=10.0,minimum-scale=0.5,user-scalable=yes">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{height:100%;width:100%;overflow:hidden;background:#e8eaf0;-webkit-user-select:none;user-select:none}
#map{
  position:absolute;top:0;left:0;right:0;bottom:0;
  touch-action:pan-x pan-y pinch-zoom;
}
.leaflet-bottom.leaflet-left{bottom:80px!important;left:12px!important}
.leaflet-control-zoom{border:none!important;box-shadow:0 3px 18px rgba(0,0,0,0.22)!important;border-radius:16px!important;margin:0!important;overflow:hidden}
.leaflet-control-zoom-in,.leaflet-control-zoom-out{
  width:56px!important;height:56px!important;line-height:56px!important;
  font-size:32px!important;color:#444!important;background:#fff!important;
  border:none!important;display:block!important;text-align:center!important;
}
.leaflet-control-zoom-in:active,.leaflet-control-zoom-out:active{background:#EEF4FF!important}
.leaflet-control-zoom-in{border-bottom:1px solid #eee!important}
.leaflet-control-attribution{font-size:8px!important;opacity:0.3}
.leaflet-popup-content-wrapper{border-radius:12px!important;border:none!important;box-shadow:0 4px 18px rgba(0,0,0,0.15)!important;padding:0!important}
.leaflet-popup-content{margin:0!important}
.leaflet-popup-tip-container{display:none!important}
.pulse-ring{
  position:absolute;width:60px;height:60px;
  border-radius:50%;background:rgba(26,115,232,0.25);
  margin-left:-9px;margin-top:-9px;
  animation:pulse 2.2s ease-out infinite;
  pointer-events:none;
}
@keyframes pulse{0%{transform:scale(0.6);opacity:1}100%{transform:scale(2.2);opacity:0}}
.fab{
  position:fixed;right:14px;width:54px;height:54px;border-radius:50%;
  background:#fff;border:none;outline:none;
  box-shadow:0 3px 16px rgba(0,0,0,0.22);
  font-size:22px;z-index:9000;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  -webkit-tap-highlight-color:transparent;
  touch-action:manipulation;
  transition:transform 0.1s ease,box-shadow 0.1s ease;
}
.fab:active{transform:scale(0.86);box-shadow:0 1px 6px rgba(0,0,0,0.14)}
#btnLocate{bottom:88px}
</style>
</head>
<body>
<div id="map"></div>
<button class="fab" id="btnLocate" onclick="locateBus()" title="Locate Bus">&#127919;</button>
<script>
var map=L.map('map',{
  zoomControl:true,attributionControl:true,
  tap:true,tapTolerance:30,
  touchZoom:true,pinchZoom:true,
  bounceAtZoomLimits:false,
  zoomSnap:0.25,zoomDelta:1,
  wheelPxPerZoomLevel:60,wheelDebounceTime:20,
  maxZoom:21,minZoom:4,
  preferCanvas:true,
  renderer:L.canvas({padding:0.5,tolerance:10})
}).setView([${lat},${lng}],17);
map.zoomControl.setPosition('bottomleft');

L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=en&scale=2',{
  subdomains:['0','1','2','3'],maxZoom:21,
  updateWhenIdle:false,updateWhenZooming:false,
  keepBuffer:8,detectRetina:true,attribution:'© Google Maps'
}).addTo(map);

var stopsData=${JSON.stringify(stops)};

if(stopsData.length>1){
  var c=stopsData.map(function(s){return[s.lat,s.lng];});
  L.polyline(c,{color:'#BDD5FA',weight:14,opacity:0.45,lineJoin:'round',lineCap:'round'}).addTo(map);
  L.polyline(c,{color:'#1A73E8',weight:7,opacity:0.95,lineJoin:'round',lineCap:'round',smoothFactor:1.5}).addTo(map);
}

stopsData.forEach(function(s,i){
  var isFirst=i===0,isLast=i===stopsData.length-1;
  var col=isFirst?'#34A853':isLast?'#EA4335':'#1A73E8';
  var r=isFirst?12:isLast?14:9;
  L.circleMarker([s.lat,s.lng],{radius:r,fillColor:col,color:'#fff',weight:3,fillOpacity:1,pane:'markerPane'})
   .addTo(map).bindPopup('<div style="padding:9px 13px;font-size:14px;font-weight:bold;color:'+col+'">'+(isFirst?'🟢 ':isLast?'🏫 ':'📍 ')+s.name+'</div>',{closeButton:false,offset:[0,-6]});
  if(isFirst){
    L.marker([s.lat,s.lng],{icon:L.divIcon({
      html:'<div style="background:#34A853;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 8px rgba(52,168,83,0.5);margin-top:18px">START<\/div>',
      className:'',iconSize:[52,22],iconAnchor:[26,-5]
    }),interactive:false,zIndexOffset:400}).addTo(map);
  }
});

var busIcon=L.divIcon({
  html:'<div style="position:relative;width:42px;height:42px">'+
    '<div class="pulse-ring"><\/div>'+
    '<div style="background:#fff;border:3px solid #1A73E8;border-radius:50%;width:42px;height:42px;'+
    'display:flex;align-items:center;justify-content:center;'+
    'box-shadow:0 4px 16px rgba(26,115,232,0.45);position:relative;z-index:2">'+
    '<span style="font-size:20px">&#x1F68C;<\/span><\/div>'+
    '<div id="spd" style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);'+
    'background:#1A73E8;color:#fff;font-size:10px;font-weight:700;'+
    'border-radius:7px;padding:2px 7px;white-space:nowrap;'+
    'box-shadow:0 2px 6px rgba(26,115,232,0.4);transition:background 0.4s">0 km\/h<\/div>'+
  '<\/div>',
  className:'',iconSize:[42,62],iconAnchor:[21,21]
});
var busLat=${lat},busLng=${lng};
var busMarker=L.marker([busLat,busLng],{icon:busIcon,zIndexOffset:3000,keyboard:false}).addTo(map)
  .bindPopup('<div style="padding:9px 13px"><div style="font-size:14px;font-weight:bold;color:#1A73E8">&#x1F68C; Bus RJ-14<\/div><div style="font-size:12px;color:#777;margin-top:3px">Live GPS Tracking<\/div><\/div>',{closeButton:false,offset:[0,-44]});

var animId=null,curLat=busLat,curLng=busLng,tgtLat=busLat,tgtLng=busLng,following=true;
function ease(t){return t<0.5?2*t*t:-1+(4-2*t)*t}
function animBus(){
  if(animId){cancelAnimationFrame(animId);animId=null}
  var sLat=curLat,sLng=curLng,eLat=tgtLat,eLng=tgtLng;
  var d=Math.sqrt(Math.pow(eLat-sLat,2)+Math.pow(eLng-sLng,2));
  if(d>0.015){curLat=eLat;curLng=eLng;busMarker.setLatLng([curLat,curLng]);if(following)map.panTo([curLat,curLng],{animate:false});return}
  var t0=null,dur=1800;
  function step(ts){
    if(!t0)t0=ts;
    var p=Math.min((ts-t0)/dur,1),e=ease(p);
    curLat=sLat+(eLat-sLat)*e;curLng=sLng+(eLng-sLng)*e;
    busMarker.setLatLng([curLat,curLng]);
    if(p<1){animId=requestAnimationFrame(step)}else{curLat=eLat;curLng=eLng;animId=null}
  }
  animId=requestAnimationFrame(step);
  if(following)map.panTo([eLat,eLng],{animate:true,duration:1.5,easeLinearity:0.2,noMoveStart:true});
}
map.on('dragstart',function(){following=false});

function locateBus(){
  following=true;
  map.flyTo([curLat,curLng],17,{animate:true,duration:1.0,easeLinearity:0.25});
}
function onMsg(e){
  try{
    var d=JSON.parse(typeof e.data==='string'?e.data:JSON.stringify(e.data));
    if(d.type==='updateBus'){
      tgtLat=parseFloat(d.lat);tgtLng=parseFloat(d.lng);
      var spd=Math.round(parseFloat(d.speed)||0);
      var el=document.getElementById('spd');
      if(el){el.textContent=spd+' km/h';el.style.background=spd>60?'#F44336':spd>40?'#FF9800':'#1A73E8'}
      animBus();
    }
  }catch(err){}
}
document.addEventListener('message',onMsg);
window.addEventListener('message',onMsg);
map.whenReady(function(){setTimeout(function(){map.invalidateSize({animate:false})},300)});
<\/script>
</body>
</html>`;

const StopRow = ({ stop, index, currentIndex, isLast }) => {
  const isDone   = index < currentIndex;
  const isActive = index === currentIndex;
  const isFirst  = index === 0;
  const dotColor = isFirst ? '#34A853' : isLast ? '#EA4335' : isDone || isActive ? PRIMARY : '#DDD';
  const times    = ['7:45 AM','8:05 AM','8:15 AM','8:30 AM'];
  return (
    <View style={styles.stopItem}>
      <View style={styles.timeline}>
        <View style={[styles.dot,{
          backgroundColor: dotColor,
          width:  isActive ? 16 : 12,
          height: isActive ? 16 : 12,
          borderRadius: 8,
          borderWidth: isActive ? 3 : 0,
          borderColor: '#D2E3FC',
        }]}/>
        {!isLast && <View style={[styles.line,{ backgroundColor: isDone ? PRIMARY : '#DDD' }]}/>}
      </View>
      <View style={styles.stopTextContent}>
        <Text style={[styles.stopName, isDone && styles.textDone, isActive && styles.textActive]}>
          {isFirst ? '🟢 ' : isLast ? '🏫 ' : ''}
          {stop.name}
          {isActive ? ' 🚌' : ''}
        </Text>
        <Text style={styles.stopTime}>{times[index] || ''}</Text>
      </View>
      {isActive && (
        <View style={styles.hereTag}>
          <Text style={styles.hereText}>BUS HERE</Text>
        </View>
      )}
    </View>
  );
};

const NavBtn = ({ icon, label, active, onPress }) => (
  <TouchableOpacity style={styles.navItem} onPress={onPress}>
    <Text style={[styles.navIcon, active && { color: PRIMARY }]}>{icon}</Text>
    <Text style={[styles.navText, active && { color: PRIMARY, fontWeight:'bold' }]}>{label}</Text>
  </TouchableOpacity>
);

export default function HomeScreen({ user, onLogout }) {
  const [busData,          setBusData]          = useState({ lat:26.9124, lng:75.7873, speed:0, busId:'BUS001' });
  const [stops,            setStops]            = useState([]);
  const [connected,        setConnected]        = useState(false);
  const [busAddress,       setBusAddress]       = useState('Locating...');
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [refreshing,       setRefreshing]       = useState(false);
  // FULLSCREEN: use Modal so it truly covers everything
  const [isFullscreen,     setIsFullscreen]     = useState(false);

  const socketRef  = useRef(null);
  const webViewRef = useRef(null);
  const fsWebViewRef = useRef(null);

  const fetchStops = useCallback(async () => {
    try {
      const token = await getToken();
      const data  = await getStops('BUS001', token);
      setStops(Array.isArray(data) ? data : []);
    } catch(e){ console.log('stops:',e); }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStops();
    setRefreshing(false);
  }, [fetchStops]);

  useEffect(() => { fetchStops(); }, [fetchStops]);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { transports:['websocket'], reconnection:true, reconnectionDelay:1000 });
    socketRef.current.on('connect',    () => setConnected(true));
    socketRef.current.on('disconnect', () => setConnected(false));

    socketRef.current.on('locationUpdate', async (data) => {
      const lat   = parseFloat(data.lat);
      const lng   = parseFloat(data.lng);
      const speed = Math.round(parseFloat(data.speed)||0);
      setBusData({ lat, lng, speed, busId: data.busId||'BUS001' });

      // Send to both normal and fullscreen WebView
      const msg = JSON.stringify({ type:'updateBus', lat, lng, speed });
      webViewRef.current?.postMessage(msg);
      fsWebViewRef.current?.postMessage(msg);

      setStops(prev => {
        if(prev.length){
          let ni=0, nd=Infinity;
          prev.forEach((s,i)=>{ const d=getDistKm(lat,lng,s.lat,s.lng); if(d<nd){nd=d;ni=i;} });
          setCurrentStopIndex(ni);
        }
        return prev;
      });

      try {
        const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const addr = await res.json();
        setBusAddress(addr.address?.road||addr.address?.suburb||addr.address?.city||'Jaipur');
      } catch { setBusAddress('Location updating...'); }
    });
    return () => socketRef.current?.disconnect();
  }, []);

  const distToSchool = useMemo(() => {
    if(!stops.length) return null;
    const s = stops[stops.length-1];
    return getDistKm(busData.lat, busData.lng, s.lat, s.lng);
  }, [busData.lat, busData.lng, stops]);

  const eta        = distToSchool != null ? getETA(distToSchool, busData.speed) : '-- min';
  const speedColor = busData.speed>60?'#F44336':busData.speed>40?'#FF9800':'#1E8E3E';
  const nextStop   = stops[currentStopIndex+1];

  const mapHtml = useMemo(() => buildMapHtml(busData.lat, busData.lng, stops), [stops]); // eslint-disable-line

  // The actual WebView (reused in both normal and fullscreen)
  const MapWebView = ({ wvRef }) => (
    <View style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => false}
      onMoveShouldSetResponder={() => false}>
      <WebView
        ref={wvRef}
        source={{ html: mapHtml }}
        style={{ flex:1 }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled={false}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback
        androidLayerType="hardware"
        androidHardwareAccelerationDisabled={false}
        startInLoadingState={false}
        bounces={false}
        overScrollMode="never"
        onError={e=>console.log('MapErr:',e.nativeEvent)}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content"/>

      {/* ── FULLSCREEN MODAL — uses Modal so it covers EVERYTHING ── */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={styles.fsContainer}>
          <MapWebView wvRef={fsWebViewRef} />
          {/* Close button in fullscreen */}
          <TouchableOpacity
            style={styles.fsCloseBtn}
            onPress={() => setIsFullscreen(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.fsCloseTxt}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Where Is My Bus</Text>
          <Text style={styles.busNumberText}>Bus RJ-14 • Morning Route</Text>
        </View>
        <View style={[styles.liveBadge,{ backgroundColor:connected?'#E6F4EA':'#FEE8E6' }]}>
          <View style={[styles.pulseDot,{ backgroundColor:connected?'#34A853':'#EA4335' }]}/>
          <Text style={[styles.liveBadgeText,{ color:connected?'#1E8E3E':'#C5221F' }]}>
            {connected?'LIVE':'OFFLINE'}
          </Text>
        </View>
      </View>

      {/* ── Map (normal mode) ── */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          (() => {
            const L = require('leaflet');
            const { MapContainer, TileLayer, Marker:LM, Popup, Polyline:LP, useMap } = require('react-leaflet');
            require('leaflet/dist/leaflet.css');
            function AutoCenter({ lat, lng }){
              const m=useMap();
              useEffect(()=>{ m.setView([lat,lng],m.getZoom(),{animate:true,duration:1}); },[lat,lng]);
              return null;
            }
            const bi=L.divIcon({ html:`<div style="background:#fff;border:3px solid ${PRIMARY};border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(26,115,232,0.4);font-size:20px">🚌</div>`, className:'', iconSize:[42,42], iconAnchor:[21,21] });
            const si=L.divIcon({ html:`<div style="width:12px;height:12px;background:${PRIMARY};border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.22)"></div>`, className:'', iconSize:[12,12], iconAnchor:[6,6] });
            const sci=L.divIcon({ html:`<div style="width:18px;height:18px;background:#EA4335;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.28)"></div>`, className:'', iconSize:[18,18], iconAnchor:[9,9] });
            return (
              <div style={{ height:'100%', width:'100%' }}>
                <MapContainer center={[busData.lat,busData.lng]} zoom={15} style={{ height:'100%',width:'100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                  <AutoCenter lat={busData.lat} lng={busData.lng}/>
                  {stops.length>1 && <LP positions={stops.map(s=>[s.lat,s.lng])} color={PRIMARY} weight={5} opacity={0.92}/>}
                  {stops.map((s,i)=>(
                    <LM key={s.id||i} position={[s.lat,s.lng]} icon={i===stops.length-1?sci:si}>
                      <Popup><b>{i===stops.length-1?'🏫 ':'📍 '}{s.name}</b></Popup>
                    </LM>
                  ))}
                  <LM position={[busData.lat,busData.lng]} icon={bi}>
                    <Popup>🚌 Bus RJ-14 | {busData.speed} km/h</Popup>
                  </LM>
                </MapContainer>
              </div>
            );
          })()
        ) : (
          <MapWebView wvRef={webViewRef} />
        )}

        {/* Speed badge */}
        <View style={[styles.speedBadge,{ borderColor:speedColor }]}>
          <Text style={[styles.speedBadgeText,{ color:speedColor }]}>⚡ {busData.speed} km/h</Text>
        </View>

        {/* FULLSCREEN BUTTON — opens Modal */}
        <TouchableOpacity
          style={styles.fsBtn}
          onPress={() => setIsFullscreen(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.fsBtnTxt}>⛶</Text>
        </TouchableOpacity>
      </View>

      {/* ── Scrollable Bottom Sheet ── */}
      <ScrollView
        style={styles.detailsContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom:100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            colors={[PRIMARY]} tintColor={PRIMARY}/>
        }
      >
        <View style={styles.dragHandle}/>

        {/* Quick Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>📍 Near</Text>
            <Text style={styles.statValue} numberOfLines={1}>{busAddress}</Text>
          </View>
          <View style={styles.statDivider}/>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>🚩 Next Stop</Text>
            <Text style={styles.statValue}>{nextStop?.name||'School'}</Text>
          </View>
          <View style={styles.statDivider}/>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>🕐 ETA</Text>
            <Text style={[styles.statValue,{ color:PRIMARY }]}>{eta}</Text>
          </View>
        </View>

        {/* Status Pills */}
        <View style={styles.statusRow}>
          <View style={[styles.statusPill,{ borderColor:speedColor }]}>
            <Text style={[styles.statusPillText,{ color:speedColor }]}>⚡ {busData.speed} km/h</Text>
          </View>
          <View style={[styles.statusPill,{ borderColor:'#1E8E3E' }]}>
            <Text style={[styles.statusPillText,{ color:'#1E8E3E' }]}>● On Time</Text>
          </View>
          <View style={[styles.statusPill,{ borderColor:'#666' }]}>
            <Text style={[styles.statusPillText,{ color:'#666' }]}>
              📏 {distToSchool!=null?`${distToSchool.toFixed(1)} km`:'--'}
            </Text>
          </View>
        </View>

        {/* Route Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route Progress</Text>
          {stops.map((stop, i) => (
            <StopRow key={stop.id||i} stop={stop} index={i}
              currentIndex={currentStopIndex} isLast={i===stops.length-1}/>
          ))}
          {!stops.length && (
            <Text style={{ color:'#aaa', textAlign:'center', padding:16 }}>Loading stops...</Text>
          )}
        </View>

        {/* Driver Card */}
        <View style={styles.driverCard}>
          <View style={styles.driverInfo}>
            <View style={styles.avatar}>
              <Text style={{ fontSize:22 }}>👨</Text>
            </View>
            <View style={{ marginLeft:12 }}>
              <Text style={styles.driverName}>Ramesh Singh</Text>
              <Text style={styles.driverSub}>⭐ 4.8 • Verified Driver</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓ VERIFIED</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.callBtn}>
            <Text style={styles.callBtnText}>📞 Call</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Bottom Nav ── */}
      <View style={styles.bottomNav}>
        <NavBtn icon="🏠" label="Home" active/>
        <NavBtn icon="📍" label="Map"/>
        <NavBtn icon="🔔" label="Alerts"/>
        <NavBtn icon="👤" label="Profile" onPress={() => { logout(); onLogout(); }}/>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container       : { flex:1, backgroundColor:'#FFF' },
  header          : { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                      paddingHorizontal:16, paddingVertical:12,
                      backgroundColor:'#FFF', borderBottomWidth:1, borderBottomColor:'#EEE' },
  headerTitle     : { fontSize:18, fontWeight:'bold', color:'#111' },
  busNumberText   : { fontSize:12, color:'#666', marginTop:2 },
  liveBadge       : { flexDirection:'row', alignItems:'center',
                      paddingHorizontal:10, paddingVertical:5, borderRadius:12 },
  liveBadgeText   : { fontSize:10, fontWeight:'bold' },
  pulseDot        : { width:7, height:7, borderRadius:4, marginRight:5 },

  mapContainer    : { height:SCREEN_HEIGHT*0.42, width:'100%', position:'relative', backgroundColor:'#e8eaf0' },
  speedBadge      : { position:'absolute', top:10, left:10,
                      backgroundColor:'rgba(255,255,255,0.95)',
                      borderWidth:1.5, borderRadius:20,
                      paddingHorizontal:10, paddingVertical:5 },
  speedBadgeText  : { fontSize:12, fontWeight:'bold' },


  fsBtn           : { position:'absolute', bottom:16, right:16,
                      width:52, height:52, borderRadius:26,
                      backgroundColor:'#fff',
                      justifyContent:'center', alignItems:'center',
                      elevation:6,
                      shadowColor:'#000', shadowOffset:{width:0,height:3},
                      shadowOpacity:0.22, shadowRadius:6 },
  fsBtnTxt        : { fontSize:24, color:'#444' },

  
  fsContainer     : { flex:1, backgroundColor:'#000' },
  fsCloseBtn      : { position:'absolute', top:48, right:16,
                      width:44, height:44, borderRadius:22,
                      backgroundColor:'rgba(0,0,0,0.65)',
                      justifyContent:'center', alignItems:'center',
                      zIndex:99999 },
  fsCloseTxt      : { fontSize:20, color:'#fff', fontWeight:'bold' },

  detailsContainer: { flex:1, backgroundColor:'#F5F7FA',
                      marginTop:-22, borderTopLeftRadius:24, borderTopRightRadius:24,
                      paddingHorizontal:16 },
  dragHandle      : { width:42, height:5, backgroundColor:'#DDD', borderRadius:3,
                      alignSelf:'center', marginVertical:10 },

  statsCard       : { flexDirection:'row', alignItems:'center',
                      backgroundColor:'#FFF', padding:14, borderRadius:16,
                      elevation:3, shadowColor:'#000', shadowOffset:{width:0,height:2},
                      shadowOpacity:0.08, shadowRadius:6, marginBottom:12 },
  statBox         : { flex:1, alignItems:'center' },
  statDivider     : { width:1, height:32, backgroundColor:'#EEE' },
  statLabel       : { fontSize:10, color:'#888', marginBottom:3 },
  statValue       : { fontSize:13, fontWeight:'bold', color:'#111', textAlign:'center' },

  statusRow       : { flexDirection:'row', gap:8, marginBottom:12 },
  statusPill      : { borderWidth:1.5, borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  statusPillText  : { fontSize:11, fontWeight:'bold' },

  section         : { backgroundColor:'#FFF', padding:16, borderRadius:16,
                      elevation:2, shadowColor:'#000', shadowOffset:{width:0,height:1},
                      shadowOpacity:0.07, shadowRadius:4, marginBottom:12 },
  sectionTitle    : { fontSize:15, fontWeight:'bold', color:'#111', marginBottom:14 },

  stopItem        : { flexDirection:'row', minHeight:56, alignItems:'flex-start' },
  timeline        : { width:28, alignItems:'center' },
  dot             : { zIndex:2 },
  line            : { width:2, flex:1, marginTop:3 },
  stopTextContent : { flex:1, marginLeft:12, paddingBottom:8 },
  stopName        : { fontSize:15, color:'#333' },
  textDone        : { color:'#BBB' },
  textActive      : { fontWeight:'bold', color:PRIMARY },
  stopTime        : { fontSize:12, color:'#999', marginTop:2 },
  hereTag         : { backgroundColor:'#E8F0FE', paddingHorizontal:8,
                      paddingVertical:3, borderRadius:8, alignSelf:'flex-start' },
  hereText        : { fontSize:10, color:PRIMARY, fontWeight:'bold' },

  driverCard      : { backgroundColor:'#FFF', padding:16, borderRadius:16,
                      flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                      elevation:2, shadowColor:'#000', shadowOffset:{width:0,height:1},
                      shadowOpacity:0.07, shadowRadius:4, marginBottom:8 },
  driverInfo      : { flexDirection:'row', alignItems:'center' },
  avatar          : { width:48, height:48, borderRadius:24,
                      backgroundColor:'#E8F0FE', justifyContent:'center', alignItems:'center',
                      borderWidth:2, borderColor:PRIMARY },
  driverName      : { fontSize:15, fontWeight:'bold', color:'#111' },
  driverSub       : { fontSize:12, color:'#888', marginTop:2 },
  verifiedBadge   : { backgroundColor:'#E6F4EA', borderRadius:6,
                      paddingHorizontal:6, paddingVertical:2, alignSelf:'flex-start', marginTop:4 },
  verifiedText    : { fontSize:9, color:'#1E8E3E', fontWeight:'bold' },
  callBtn         : { backgroundColor:PRIMARY, paddingHorizontal:18,
                      paddingVertical:10, borderRadius:22 },
  callBtnText     : { color:'#FFF', fontWeight:'bold', fontSize:13 },

  bottomNav       : { position:'absolute', bottom:0, flexDirection:'row',
                      backgroundColor:'#FFF', height:70, width:'100%',
                      borderTopWidth:1, borderTopColor:'#EEE', elevation:10 },
  navItem         : { flex:1, justifyContent:'center', alignItems:'center', paddingBottom:8 },
  navIcon         : { fontSize:22, color:'#888' },
  navText         : { fontSize:11, color:'#888', marginTop:2 },
});