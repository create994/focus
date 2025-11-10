const axios = require('axios');
const config = require('../utils/config');
const logger = require('../utils/logger');

const axiosInstance = axios.create({
  baseURL: config.maxApiBaseUrl,
  timeout: config.apiTimeoutMs
});

axiosInstance.interceptors.request.use((request) => {
  if (config.maxBotToken) {
    request.headers.Authorization = `Bearer ${config.maxBotToken}`;
  }
  request.headers['Content-Type'] = 'application/json';
  return request;
});

const mockStore = {
  messages: new Map()
};

const buildMockResponse = (data, status = 200) => ({
  status,
  data
});

const interpretStatus = (status) => {
  switch (status) {
    case 400:
      return 'Invalid prompt payload sent to MAX API.';
    case 401:
      return 'Authentication with MAX API failed. Verify MAX_BOT_TOKEN.';
    case 404:
      return 'Requested MAX API resource was not found.';
    case 405:
      return 'HTTP method not supported by MAX API endpoint.';
    case 429:
      return 'Rate limit exceeded when calling MAX API.';
    case 503:
      return 'MAX API temporarily unavailable.';
    default:
      return 'Unexpected MAX API error.';
  }
};

const handleError = (error) => {
  if (error.response) {
    const message = interpretStatus(error.response.status);
    logger.error('MAX API responded with error', {
      status: error.response.status,
      message,
      data: error.response.data
    });
    const normalizedError = new Error(message);
    normalizedError.status = error.response.status;
    normalizedError.data = error.response.data;
    throw normalizedError;
  }

  logger.error('MAX API request failed', { error: error.message });
  throw error;
};

const sendMessage = async ({ chatId, message }) => {
  if (!chatId) {
    throw new Error('chatId is required to send a message');
  }

  if (config.useMockMaxApi) {
    const messageId = `mock-${Date.now()}`;
    const payload = { id: messageId, chatId, message, status: 'delivered' };
    mockStore.messages.set(messageId, payload);
    logger.debug('Mock MAX message sent', payload);
    return buildMockResponse(payload);
  }

  if (!config.maxBotToken) {
    throw new Error('MAX_BOT_TOKEN must be set when USE_MOCK_MAX_API=false');
  }

  try {
    const response = await axiosInstance.post('/messages', {
      chat_id: chatId,
      payload: message
    });
    return response;
  } catch (error) {
    handleError(error);
  }
};

const fetchMessage = async (messageId) => {
  if (config.useMockMaxApi) {
    if (!mockStore.messages.has(messageId)) {
      return buildMockResponse({ error: 'Not found' }, 404);
    }
    return buildMockResponse(mockStore.messages.get(messageId));
  }

  try {
    return await axiosInstance.get(`/messages/${messageId}`);
  } catch (error) {
    handleError(error);
  }
};

const updateChat = async (chatId, payload) => {
  if (config.useMockMaxApi) {
    logger.debug('Mock chat update', { chatId, payload });
    return buildMockResponse({ chatId, payload, status: 'updated' });
  }

  if (!config.maxBotToken) {
    throw new Error('MAX_BOT_TOKEN must be set when USE_MOCK_MAX_API=false');
  }

  try {
    return await axiosInstance.patch(`/chats/${chatId}`, payload);
  } catch (error) {
    handleError(error);
  }
};

const handleIncomingMessage = async (incomingPayload) => {
  try {
    const botLogic = require('./botLogic'); // Lazy load to avoid circular dependency
    await botLogic.processIncomingMessage(incomingPayload);
    return { status: 200, success: true };
  } catch (error) {
    logger.error('Failed to handle incoming MAX message', { error: error.message });
    return {
      status: 500,
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sendMessage,
  fetchMessage,
  updateChat,
  handleIncomingMessage
};

