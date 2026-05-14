export const API_BASE_URL = "https://emp-manage-backend.onrender.com";

async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const rawText = await response.text();
  let data = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText ? { message: rawText } : null;
  }

  if (!response.ok) {
    const message = String(data?.message || "").trim();

    if (/Cannot\s+(GET|POST|PUT|PATCH|DELETE)\s+/i.test(message)) {
      throw new Error("This action is not available yet because the backend does not expose this API.");
    }

    throw new Error(message || "Request failed");
  }

  return data;
}

export function loginUser(payload) {
  return request("/user/login", {
    method: "POST",
    body: payload
  });
}

export function registerUser(payload) {
  return request("/user/register", {
    method: "POST",
    body: payload
  });
}

export function resetUserPassword(payload) {
  return request("/user/forgot-password", {
    method: "POST",
    body: payload
  });
}

export function getAttendanceByDate(date, token) {
  return request(`/attendance/date?date=${encodeURIComponent(date)}`, {
    token
  });
}

export function markAttendance(payload, token) {
  return request("/attendance/mark", {
    method: "POST",
    token,
    body: payload
  });
}

export function addWorker(payload, token) {
  return request("/worker/add", {
    method: "POST",
    token,
    body: payload
  });
}

export function editWorker(workerId, payload, token) {
  return request(`/worker/edit/${encodeURIComponent(workerId)}`, {
    method: "PUT",
    token,
    body: payload
  });
}

export function storeBill(payload, token) {
  return request("/bill/store", {
    method: "POST",
    token,
    body: payload
  });
}

export function getBills(token) {
  return request("/bill/get-bills", {
    token
  });
}

export function getBillById(billId, token) {
  return request(`/bill/${encodeURIComponent(billId)}`, {
    token
  });
}

export function deleteBill(billId, token) {
  return request(`/bill/delete/${encodeURIComponent(billId)}`, {
    method: "DELETE",
    token
  });
}
