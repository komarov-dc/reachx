const socket = io('/');
const peer = new Peer(undefined, {
  host: '/',
  port: '3000',
  path: '/peerjs'
});

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');
const remoteIdInput = document.getElementById('remoteId');
const peerIdDisplay = document.getElementById('peerId');

let localStream;

peer.on('open', (id) => {
  peerIdDisplay.textContent = `Your Peer ID: ${id}`;
});

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then((stream) => {
    localStream = stream;
    localVideo.srcObject = stream;
  });

startCallButton.addEventListener('click', () => {
  const remoteId = remoteIdInput.value;
  const call = peer.call(remoteId, localStream);
  handleCall(call);
});

peer.on('call', (call) => {
  call.answer(localStream);
  handleCall(call);
});

function handleCall(call) {
  call.on('stream', (remoteStream) => {
    remoteVideo.srcObject = remoteStream;
  });
}