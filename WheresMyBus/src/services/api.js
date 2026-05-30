import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API = 'https://whereismybus-backend.onrender.com';

export const loginUser = async (phone) => {
  const res = await axios.post(`${API}/api/auth/login`, { phone });
  return res.data;
};

export const registerUser = async (phone, name, role) => {
  const res = await axios.post(`${API}/api/auth/register`, { phone, name, role });
  return res.data;
};

export const getStops = async (busId, token) => {
  const res = await axios.get(`${API}/api/stops/${busId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data.stops;
};

export const saveAuth = async (token, user) => {
  await AsyncStorage.setItem('token', token);
  await AsyncStorage.setItem('user', JSON.stringify(user));
};

export const getToken = async () => AsyncStorage.getItem('token');
export const getUser = async () => {
  const u = await AsyncStorage.getItem('user');
  return u ? JSON.parse(u) : null;
};

export const logout = async () => {
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('user');
};

export const SOCKET_URL = API;