const socket = io('/');
const peer = new Peer(undefined, {
  host: '/',
  port: '3000',
  path: '/peerjs',
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.ekiga.net' },
      { urls: 'stun:stun.schlund.de' },
      { urls: 'stun:stun.voipbuster.com' },
      { urls: 'stun:stun.voipstunt.com' },
      {
        urls: 'turn:your-turn-server.com:3478',
        username: 'your-username',
        credential: 'your-password'
      }
    ]
  },
  debug: 3,
  reconnectTimer: 10000,
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
  socket.emit('client-log', message);
}

// Add this function to perform network checks
const stunServers = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
  'stun:stun.ekiga.net',
  'stun:stun.schlund.de',
  'stun:stun.voipbuster.com',
  'stun:stun.voipstunt.com'
];

const turnServers = [
  { urls: 'turn:numb.viagenie.ca', username: 'webrtc@live.com', credential: 'muazkh' },
  { urls: 'turn:turn.anyfirewall.com:443?transport=tcp', username: 'webrtc', credential: 'webrtc' }
];

async function testStunServer(stunServer) {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: stunServer }]
    });
    
    let stunReachable = false;
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        log(`ICE candidate for ${stunServer}: ${JSON.stringify(event.candidate)}`);
        if (event.candidate.type === 'srflx') {
          stunReachable = true;
          resolve(true);
        }
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete' && !stunReachable) {
        resolve(false);
      }
    };

    pc.createDataChannel('test');
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(error => log(`Error creating offer for ${stunServer}: ${error}`));

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!stunReachable) {
        resolve(false);
      }
    }, 5000);
  });
}

async function testTurnServer(turnServer) {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({
      iceServers: [turnServer]
    });
    
    let turnReachable = false;
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        log(`ICE candidate for ${turnServer.urls}: ${JSON.stringify(event.candidate)}`);
        if (event.candidate.type === 'relay') {
          turnReachable = true;
          resolve(true);
        }
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete' && !turnReachable) {
        resolve(false);
      }
    };

    pc.createDataChannel('test');
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(error => log(`Error creating offer for ${turnServer.urls}: ${error}`));

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!turnReachable) {
        resolve(false);
      }
    }, 5000);
  });
}

async function getNetworkInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection) {
    log(`Network type: ${connection.type}`);
    log(`Effective network type: ${connection.effectiveType}`);
    log(`Downlink: ${connection.downlink} Mbps`);
    log(`Round-trip time: ${connection.rtt} ms`);
  } else {
    log('Network information not available');
  }
}

async function performNetworkChecks() {
  log('Starting network checks...');

  await getNetworkInfo();

  // Check internet connectivity
  try {
    const response = await fetch('https://www.google.com', { mode: 'no-cors' });
    log('Internet connectivity: OK');
  } catch (error) {
    log('Internet connectivity: FAILED');
  }

  // Check WebSocket connection
  if (socket.connected) {
    log('WebSocket connection: OK');
  } else {
    log('WebSocket connection: FAILED');
  }

  // Test STUN servers
  log('Testing STUN servers...');
  for (const stunServer of stunServers) {
    const isReachable = await testStunServer(stunServer);
    log(`STUN server ${stunServer}: ${isReachable ? 'OK' : 'FAILED'}`);
    if (isReachable) {
      peer.options.config.iceServers.push({ urls: stunServer });
    }
  }

  // Test TURN servers
  log('Testing TURN servers...');
  for (const turnServer of turnServers) {
    const isReachable = await testTurnServer(turnServer);
    log(`TURN server ${turnServer.urls}: ${isReachable ? 'OK' : 'FAILED'}`);
    if (isReachable) {
      peer.options.config.iceServers.push(turnServer);
    }
  }

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
  call.peerConnection.addEventListener('connectionstatechange', () => {
    log(`Connection state changed: ${call.peerConnection.connectionState}`);
  });

  call.peerConnection.addEventListener('icegatheringstatechange', () => {
    log(`ICE gathering state changed: ${call.peerConnection.iceGatheringState}`);
  });

  // Monitor connection quality
  setInterval(() => {
    call.peerConnection.getStats().then(stats => {
      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          log(`Current RTT: ${report.currentRoundTripTime}`);
        }
      });
    });
  }, 5000);
}

// Modify error event listeners
peer.on('error', (error) => {
  console.error('PeerJS error:', error);
  log(`PeerJS error: ${error.type} - ${error.message}`);
});

socket.on('connect_error', (error) => {
  console.error('Socket.IO connection error:', error);
  log(`Socket.IO connection error: ${error.message}`);
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