import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const register = async (username, password) => {
  const response = await axios.post(`${API_URL}/auth/register`, {
    username,
    password
  });
  return response.data;
};

export const login = async (username, password) => {
  const response = await axios.post(`${API_URL}/auth/login`, {
    username,
    password
  });
  return response.data;
};

export const createRoom = async (gameType) => {
  const username = localStorage.getItem('username');
  const response = await axios.post(`${API_URL}/rooms/create`, {
    gameType,
    username
  });
  return response.data;
};

export const joinRoom = async (roomCode) => {
  const username = localStorage.getItem('username');
  const response = await axios.post(`${API_URL}/rooms/join`, {
    roomCode,
    username
  });
  return response.data;
};