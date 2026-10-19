import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const API = API_BASE_URL;

const getAuthHeader = () => {
  const token = localStorage.getItem('smartplate_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// NGO APIs
export const ngoApi = {
  submitVerification: (data) => 
    axios.post(`${API}/ngo/verification`, data, { headers: getAuthHeader() }),
  
  getVerification: () => 
    axios.get(`${API}/ngo/verification`, { headers: getAuthHeader() }),
  
  getRequests: () => 
    axios.get(`${API}/ngo/requests`, { headers: getAuthHeader() }),
  
  confirmReceipt: (requestId) =>
    axios.post(`${API}/requests/${requestId}/confirm-receipt`, {}, { headers: getAuthHeader() }),
};

// Food Request APIs
export const requestApi = {
  create: (data) => 
    axios.post(`${API}/requests`, data, { headers: getAuthHeader() }),
  
  getAll: (params) => 
    axios.get(`${API}/requests`, { headers: getAuthHeader(), params }),
  
  getById: (id) => 
    axios.get(`${API}/requests/${id}`, { headers: getAuthHeader() }),
};

// Donor APIs
export const donorApi = {
  createFulfillment: (data) => 
    axios.post(`${API}/donor/fulfill`, data, { headers: getAuthHeader() }),
  
  getFulfillments: () => 
    axios.get(`${API}/donor/fulfillments`, { headers: getAuthHeader() }),
};

// Volunteer APIs
export const volunteerApi = {
  getProfile: () => 
    axios.get(`${API}/volunteer/profile`, { headers: getAuthHeader() }),
  
  updateProfile: (data) => 
    axios.put(`${API}/volunteer/profile`, null, { headers: getAuthHeader(), params: data }),
  
  getDeliveries: () => 
    axios.get(`${API}/volunteer/deliveries`, { headers: getAuthHeader() }),
  
  getAvailableDeliveries: (lat, lng) => 
    axios.get(`${API}/volunteer/available-deliveries`, { 
      headers: getAuthHeader(), 
      params: { lat, lng } 
    }),
  
  acceptDelivery: (deliveryId) =>
    axios.post(`${API}/volunteer/deliveries/${deliveryId}/accept`, {}, { headers: getAuthHeader() }),
  
  pickupDelivery: (deliveryId) =>
    axios.post(`${API}/volunteer/deliveries/${deliveryId}/pickup`, {}, { headers: getAuthHeader() }),
  
  completeDelivery: (deliveryId, deliveryProof) =>
    axios.post(`${API}/volunteer/deliveries/${deliveryId}/complete`, null, { 
      headers: getAuthHeader(),
      params: { delivery_proof: deliveryProof }
    }),
};

// Admin APIs
export const adminApi = {
  getDashboard: () => 
    axios.get(`${API}/admin/dashboard`, { headers: getAuthHeader() }),
  
  getPendingVerifications: () => 
    axios.get(`${API}/admin/pending-verifications`, { headers: getAuthHeader() }),
  
  reviewNGO: (verificationId, action, reason) =>
    axios.post(`${API}/admin/ngo/${verificationId}/review`, { action, reason }, { headers: getAuthHeader() }),
  
  reviewVolunteer: (userId, action, reason) =>
    axios.post(`${API}/admin/volunteer/${userId}/review`, { action, reason }, { headers: getAuthHeader() }),
  
  approveRequest: (requestId) =>
    axios.post(`${API}/admin/request/${requestId}/approve`, {}, { headers: getAuthHeader() }),
  
  getAllRequests: () =>
    axios.get(`${API}/admin/all-requests`, { headers: getAuthHeader() }),
  
  getAllDeliveries: () =>
    axios.get(`${API}/admin/all-deliveries`, { headers: getAuthHeader() }),
  
  getAllUsers: () =>
    axios.get(`${API}/admin/users`, { headers: getAuthHeader() }),
  
  markExtraVolunteer: (deliveryId) =>
    axios.post(`${API}/admin/delivery/${deliveryId}/extra-volunteer`, {}, { headers: getAuthHeader() }),
  
  assignVolunteer: (deliveryId, volunteerId) =>
    axios.post(`${API}/admin/delivery/${deliveryId}/assign-volunteer`, null, { 
      headers: getAuthHeader(),
      params: { volunteer_id: volunteerId }
    }),

  calculateUrgencyScore: (requestId) =>
    axios.post(`${API}/ai/urgency-score`, null, { 
      headers: getAuthHeader(),
      params: { request_id: requestId }
    }),
};

// Analytics APIs
export const analyticsApi = {
  getPublic: () => 
    axios.get(`${API}/analytics/public`),
  
  getUser: () => 
    axios.get(`${API}/analytics/user`, { headers: getAuthHeader() }),
};

// Utility APIs
export const utilityApi = {
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API}/upload`, formData, { 
      headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' }
    });
  },
  
  getVerifiedNGOs: () =>
    axios.get(`${API}/ngos/verified`),
  
  seedAdmin: () =>
    axios.post(`${API}/seed/admin`),
};
