import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert
} from 'react-native';
import { io } from 'socket.io-client';
import { SOCKET_URL, logout } from '../services/api';
import * as Location from 'expo-location';

export default function DriverScreen({ user, onLogout }) {
  const [tripStarted, setTripStarted] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [sosActive, setSosActive] = useState(false);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const locationInterval = useRef(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    socketRef.current.on('connect', () => setConnected(true));
    socketRef.current.on('disconnect', () => setConnected(false));
    return () => {
      socketRef.current.disconnect();
      if (locationInterval.current) clearInterval(locationInterval.current);
    };
  }, []);

  const startTrip = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Location permission chahiye');
      return;
    }
    setTripStarted(true);
    locationInterval.current = setInterval(async () => {
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude, speed: spd } = location.coords;
      const currentSpeed = spd ? Math.round(spd * 3.6) : 0;
      setSpeed(currentSpeed);
      socketRef.current.emit('sendLocation', {
        busId: 'BUS001',
        lat: latitude,
        lng: longitude,
        speed: currentSpeed
      });
    }, 5000);
  };

  const endTrip = () => {
    setTripStarted(false);
    setSosActive(false);
    setSpeed(0);
    if (locationInterval.current) clearInterval(locationInterval.current);
  };

  const triggerSOS = () => {
    setSosActive(!sosActive);
    socketRef.current.emit('sos', {
      busId: 'BUS001',
      driverName: user?.name,
      message: 'SOS Emergency!'
    });
    Alert.alert('SOS', sosActive ? 'SOS Cancelled' : '🚨 SOS Alert Sent!');
  };

  const speedColor = speed > 60 ? '#EF4444' : speed > 40 ? '#F59E0B' : '#00D4AA';

  return (
    <SafeAreaView style={s.container}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Good Morning,</Text>
          <Text style={s.name}>{user?.name || 'Driver'} 🚌</Text>
        </View>
        <View style={[s.dot, { backgroundColor: connected ? '#00D4AA' : '#EF4444' }]} />
      </View>

      {/* Bus Info */}
      <View style={s.card}>
        <Text style={s.cardLabel}>Assigned Bus</Text>
        <Text style={s.busNo}>RJ-14 | Morning Route A</Text>
        <Text style={s.students}>24 Students | 8 Stops</Text>
      </View>

      {/* Trip Active */}
      {tripStarted ? (
        <View style={s.tripActive}>

          {/* Speedometer */}
          <View style={s.speedometer}>
            <Text style={[s.speedNum, { color: speedColor }]}>{speed}</Text>
            <Text style={s.speedUnit}>km/h</Text>
            <View style={[s.speedBar, { backgroundColor: speedColor }]} />
          </View>

          {/* Speed Status */}
          <View style={[s.speedStatus, { backgroundColor: speedColor + '20' }]}>
            <Text style={[s.speedStatusText, { color: speedColor }]}>
              {speed > 60 ? '🔴 OVERSPEED!' : speed > 40 ? '🟡 Moderate' : '🟢 Safe Speed'}
            </Text>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statValue}>00:23:45</Text>
              <Text style={s.statLabel}>Trip Time</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statValue}>24</Text>
              <Text style={s.statLabel}>Students</Text>
            </View>
          </View>

          {/* End Trip */}
          <TouchableOpacity style={s.endBtn} onPress={endTrip}>
            <Text style={s.endBtnText}>⏹ End Trip</Text>
          </TouchableOpacity>

          {/* SOS */}
          <TouchableOpacity
            style={[s.sosBtn, sosActive && s.sosBtnActive]}
            onPress={triggerSOS}
          >
            <Text style={s.sosBtnText}>🆘 SOS</Text>
          </TouchableOpacity>

        </View>
      ) : (
        <View style={s.preTrip}>
          <Text style={s.busBig}>🚌</Text>
          <Text style={s.readyText}>Ready to start your trip?</Text>
          <TouchableOpacity style={s.startBtn} onPress={startTrip}>
            <Text style={s.startBtnText}>▶ START TRIP</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={async () => { await logout(); onLogout(); }}>
        <Text style={s.logoutText}>Logout</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1C' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, paddingTop: 40
  },
  greeting: { fontSize: 14, color: '#8892A4' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#F9FAFB' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  card: {
    margin: 16, backgroundColor: '#111827',
    borderRadius: 16, borderWidth: 1, borderColor: '#1E2D45', padding: 16
  },
  cardLabel: { fontSize: 11, color: '#8892A4', textTransform: 'uppercase', marginBottom: 4 },
  busNo: { fontSize: 20, fontWeight: 'bold', color: '#F9FAFB' },
  students: { fontSize: 13, color: '#8892A4', marginTop: 4 },
  tripActive: { flex: 1, alignItems: 'center', padding: 16 },
  speedometer: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: '#111827', borderWidth: 3, borderColor: '#1E2D45',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16
  },
  speedNum: { fontSize: 56, fontWeight: 'bold' },
  speedUnit: { fontSize: 16, color: '#8892A4' },
  speedBar: { width: 60, height: 4, borderRadius: 2, marginTop: 8 },
  speedStatus: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, marginBottom: 16
  },
  speedStatusText: { fontWeight: 'bold', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16, width: '100%' },
  statCard: {
    flex: 1, backgroundColor: '#111827', borderRadius: 12,
    borderWidth: 1, borderColor: '#1E2D45', padding: 16, alignItems: 'center'
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#F9FAFB' },
  statLabel: { fontSize: 11, color: '#8892A4', marginTop: 4 },
  endBtn: {
    backgroundColor: '#EF4444', borderRadius: 12,
    padding: 16, alignItems: 'center', width: '100%', marginBottom: 12
  },
  endBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  sosBtn: {
    backgroundColor: '#EF444420', borderRadius: 12, borderWidth: 2,
    borderColor: '#EF4444', padding: 16, alignItems: 'center', width: '100%'
  },
  sosBtnActive: { backgroundColor: '#EF4444' },
  sosBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16 },
  preTrip: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  busBig: { fontSize: 80, marginBottom: 16 },
  readyText: { fontSize: 16, color: '#8892A4', marginBottom: 24 },
  startBtn: {
    backgroundColor: '#00D4AA', borderRadius: 16,
    padding: 20, alignItems: 'center', width: '100%'
  },
  startBtnText: { color: '#000', fontWeight: 'bold', fontSize: 18 },
  logoutBtn: { padding: 16, alignItems: 'center' },
  logoutText: { color: '#8892A4', fontSize: 14 },
});