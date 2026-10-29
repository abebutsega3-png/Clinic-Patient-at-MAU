import axios from 'axios';

const API_URL = '/api/approvals';

const getAuthHeaders = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`
  }
});

export const fetchApprovalRequests = async (filters = {}, token) => {
  const {
    status = 'pending',
    type = 'all',
    search = '',
    department = '',
    startDate = '',
    endDate = ''
  } = filters;
  const params = new URLSearchParams({ status, type, search, department, startDate, endDate });
  const response = await axios.get(`${API_URL}?${params}`, getAuthHeaders(token));
  return response.data;
};

export const fetchApprovalRequestDetails = async (id, token, source = 'approval') => {
  const response = await axios.get(`${API_URL}/${id}`, {
    ...getAuthHeaders(token),
    params: { source }
  });
  return response.data;
};

export const updateRequestStatus = async (
  id,
  status,
  comment = '',
  token,
  recordSource = 'approval',
  approvedQuantity
) => {
  const response = await axios.patch(
    `${API_URL}/${id}/status`,
    { status, comment, recordSource, ...(approvedQuantity !== undefined ? { approvedQuantity } : {}) },
    getAuthHeaders(token)
  );
  return response.data;
};

export const updatePurchaseRequestPriority = async (id, priority, token) => {
  const response = await axios.patch(
    `${API_URL}/${id}/priority`,
    { priority },
    getAuthHeaders(token)
  );
  return response.data;
};

export const receivePurchaseRequest = async (id, token) => {
  const response = await axios.patch(
    `${API_URL}/${id}/fulfillment`,
    {},
    getAuthHeaders(token)
  );
  return response.data;
};

export const fetchMyDepartmentRequests = async (token) => {
  const response = await axios.get(`${API_URL}/mine?type=all`, getAuthHeaders(token));
  return response.data;
};

export const fetchMyPurchaseRequests = async (token) => {
  const response = await axios.get(`${API_URL}/mine?type=purchase`, getAuthHeaders(token));
  return response.data;
};

export const bulkApproveRequests = async (ids, token) => {
  const response = await axios.post(`${API_URL}/bulk-approve`, {
    ids: ids.map(({ _id, recordSource = 'approval' }) => ({ id: _id, recordSource }))
  }, getAuthHeaders(token));
  return response.data;
};

export const createApprovalRequest = async (request, token) => {
  const response = await axios.post(API_URL, request, getAuthHeaders(token));
  return response.data;
};

export const resubmitApprovalRequest = async (id, updates, token) => {
  const response = await axios.patch(
    `${API_URL}/${id}/resubmit`,
    updates,
    getAuthHeaders(token)
  );
  return response.data;
};

export const fetchMyNotifications = async (token) => {
  const response = await axios.get(`${API_URL}/notifications`, getAuthHeaders(token));
  return response.data;
};

export const markNotificationRead = async (id, token) => {
  const response = await axios.patch(`${API_URL}/notifications/${id}/read`, {}, getAuthHeaders(token));
  return response.data;
};

export const dismissNotification = async (id, token) => {
  const response = await axios.delete(`${API_URL}/notifications/${id}`, getAuthHeaders(token));
  return response.data;
};
