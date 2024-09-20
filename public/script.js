const socket = io('/');
const peer = new Peer(undefined, {
  host: '/',
  port: '3000',
  path: '/peerjs',
  config: {
    'iceServers': [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ]
  }
});

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');
const remoteIdInput = document.getElementById('remoteId');
const peerIdDisplay = document.getElementById('peerId');
const connectionStatus = document.getElementById('connectionStatus');

let localStream;

peer.on('open', (id) => {
  console.log(`Connected to PeerJS with ID: ${id}`);
  peerIdDisplay.textContent = `Your Peer ID: ${id}`;
  connectionStatus.textContent = 'Connection status: Connected to signaling server';
  // Join a room when connected
  const roomId = prompt("Enter room ID:");
  if (roomId) {
    console.log(`Joining room: ${roomId}`);
    socket.emit('join-room', roomId, id);
  }
});

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then((stream) => {
    console.log('Local media stream obtained');
    localStream = stream;
    localVideo.srcObject = stream;
  })
  .catch((error) => {
    console.error('Error accessing media devices:', error);
  });

startCallButton.addEventListener('click', () => {
  const remoteId = remoteIdInput.value;
  console.log(`Initiating call to peer: ${remoteId}`);
  const call = peer.call(remoteId, localStream);
  handleCall(call);
});

peer.on('call', (call) => {
  console.log(`Receiving call from peer: ${call.peer}`);
  call.answer(localStream);
  handleCall(call);
});

socket.on('user-connected', (userId) => {
  console.log('User connected:', userId);
  // Call the newly connected user
  console.log(`Initiating call to newly connected user: ${userId}`);
  const call = peer.call(userId, localStream);
  handleCall(call);
});

socket.on('user-disconnected', (userId) => {
  console.log('User disconnected:', userId);
  // Handle disconnection (e.g., remove video element)
});

function handleCall(call) {
  console.log(`Handling call with peer: ${call.peer}`);
  connectionStatus.textContent = 'Connection status: Connecting to peer...';
  call.on('stream', (remoteStream) => {
    console.log(`Received stream from ${call.peer}`);
    remoteVideo.srcObject = remoteStream;
    connectionStatus.textContent = 'Connection status: Connected to peer';
  });
  call.on('close', () => {
    console.log(`Call with ${call.peer} has ended`);
    // Handle call ending (e.g., remove video element)
  });
  call.on('error', (error) => {
    console.error(`Error in call with ${call.peer}:`, error);
  });
}

// Add error event listeners
peer.on('error', (error) => {
  console.error('PeerJS error:', error);
});

socket.on('connect_error', (error) => {
  console.error('Socket.IO connection error:', error);
});

peer.on('disconnected', () => {
  console.log('Disconnected from PeerJS server. Attempting to reconnect...');
  connectionStatus.textContent = 'Connection status: Attempting to reconnect...';
  peer.reconnect();
});

peer.on('close', () => {
  connectionStatus.textContent = 'Connection status: Connection closed';
});