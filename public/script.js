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
      { urls: 'stun:stun.stunprotocol.org:3478' },
      { urls: 'stun:stun.voiparound.com' },
      // Add a TURN server if possible
      // { urls: 'turn:numb.viagenie.ca', username: 'webrtc@live.com', credential: 'muazkh' }
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

// Add this at the beginning of the file
let currentRoom;

// Move the log function before it's used
function log(message) {
  console.log(message);
  const logElement = document.getElementById('log');
  if (logElement) {
    const logEntry = document.createElement('div');
    logEntry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
    logElement.appendChild(logEntry);
    logElement.scrollTop = logElement.scrollHeight;
  }
  // Send log to server
  if (currentRoom) {
    socket.emit('log', { room: currentRoom, message: message });
  }
}

// Add this function to perform network checks
async function performNetworkChecks() {
  log('Starting network checks...');

  // Check internet connectivity
  try {
    const response = await fetch('https://www.google.com', { mode: 'no-cors' });
    log('Internet connectivity: OK');
  } catch (error) {
    log('Internet connectivity: FAILED');
  }

  // Check WebSocket connection (assumes your Socket.IO server is on the same host)
  if (socket.connected) {
    log('WebSocket connection: OK');
  } else {
    log('WebSocket connection: FAILED');
  }

  // Check STUN server reachability
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  
  let stunReachable = false;
  pc.onicecandidate = (event) => {
    if (event.candidate && event.candidate.type === 'srflx') {
      stunReachable = true;
      log('STUN server reachability: OK');
    }
  };

  pc.createDataChannel('test');
  await pc.createOffer().then(offer => pc.setLocalDescription(offer));

  // Wait for a short time to allow ICE gathering
  await new Promise(resolve => setTimeout(resolve, 5000));

  if (!stunReachable) {
    log('STUN server reachability: FAILED');
  }

  pc.close();

  // Check for WebRTC support
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    log('WebRTC support: OK');
  } else {
    log('WebRTC support: FAILED');
  }

  log('Network checks completed.');
}

peer.on('open', async (id) => {
  log(`Connected to PeerJS with ID: ${id}`);
  peerIdDisplay.textContent = `Your Peer ID: ${id}`;
  connectionStatus.textContent = 'Connection status: Connected to signaling server';
  
  await performNetworkChecks();

  // Join a room when connected
  currentRoom = prompt("Enter room ID:");
  if (currentRoom) {
    log(`Joining room: ${currentRoom}`);
    socket.emit('join-room', currentRoom, id);
  }
});

// Add error handling for getUserMedia
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then((stream) => {
    log('Local media stream obtained');
    localStream = stream;
    localVideo.srcObject = stream;
  })
  .catch((error) => {
    log('Error accessing media devices: ' + error.message);
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
  log('User connected: ' + userId);
  // Call the newly connected user
  log(`Initiating call to newly connected user: ${userId}`);
  const call = peer.call(userId, localStream);
  handleCall(call);
});

socket.on('user-disconnected', (userId) => {
  log('User disconnected: ' + userId);
  // Handle disconnection (e.g., remove video element)
});

// Add this event listener for receiving logs from other users
socket.on('broadcast-log', (logMessage) => {
  const logElement = document.getElementById('log');
  if (logElement) {
    const logEntry = document.createElement('div');
    logEntry.textContent = `[Remote] ${logMessage}`;
    logElement.appendChild(logEntry);
    logElement.scrollTop = logElement.scrollHeight;
  }
});

// Update the handleCall function
function handleCall(call) {
  log(`Handling call with peer: ${call.peer}`);
  connectionStatus.textContent = 'Connection status: Connecting to peer...';

  call.on('stream', (remoteStream) => {
    log(`Received stream from ${call.peer}`);
    remoteVideo.srcObject = remoteStream;
    connectionStatus.textContent = 'Connection status: Connected to peer';
  });

  call.on('close', () => {
    log(`Call with ${call.peer} has ended`);
    remoteVideo.srcObject = null;
    connectionStatus.textContent = 'Connection status: Call ended';
  });

  call.on('error', (error) => {
    log(`Error in call with ${call.peer}: ${error.message}`);
    connectionStatus.textContent = 'Connection status: Call error';
  });

  // Log the call state changes
  call.peerConnection.oniceconnectionstatechange = () => {
    log(`ICE connection state with ${call.peer}: ${call.peerConnection.iceConnectionState}`);
  };

  call.peerConnection.onconnectionstatechange = () => {
    log(`Connection state with ${call.peer}: ${call.peerConnection.connectionState}`);
  };

  call.peerConnection.onsignalingstatechange = () => {
    log(`Signaling state with ${call.peer}: ${call.peerConnection.signalingState}`);
  };

  // Log ICE candidates
  call.peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      log(`ICE candidate for ${call.peer}: ${event.candidate.candidate}`);
    }
  };
}

// Modify error event listeners
peer.on('error', (error) => {
  log('PeerJS error: ' + error.message);
});

socket.on('connect_error', (error) => {
  log('Socket.IO connection error: ' + error.message);
});

peer.on('disconnected', () => {
  log('Disconnected from PeerJS server. Attempting to reconnect...');
  connectionStatus.textContent = 'Connection status: Attempting to reconnect...';
  peer.reconnect();
});

peer.on('close', () => {
  log('Connection closed');
  connectionStatus.textContent = 'Connection status: Connection closed';
});

// Add ICE connection state change and gathering state change event listeners
peer.on('iceconnectionstatechange', (state) => {
  log(`ICE connection state changed to: ${peer.iceConnectionState}`);
});

peer.on('icegatheringstatechange', (state) => {
  log(`ICE gathering state changed to: ${peer.iceGatheringState}`);
});

// Add detailed logging for connection events
peer.on('connection', (conn) => {
  log(`Data channel connection established with peer: ${conn.peer}`);
  conn.on('open', () => {
    log(`Data channel opened with peer: ${conn.peer}`);
  });
});

socket.on('connect', () => {
  log('Connected to signaling server');
});

socket.on('disconnect', () => {
  log('Disconnected from signaling server');
});

// ... rest of the existing code ...