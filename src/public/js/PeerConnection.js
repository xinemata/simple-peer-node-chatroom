import io from 'socket.io-client';
import {addPeer, getPeer, setDataChannel} from '../store/actions.js'
import store from '../store/store.js';
import {renderIncomingEphemeralMessage} from './ephemeral.js'
import {getBrowserRTC} from './ensureWebRTC.js'
import {initPeer, removePeer, updatePeerPosition} from './users.js';

export default class PeerConnection {
  constructor () {
    this._wrtc = getBrowserRTC();
    this.socket = io.connect();
    this.channelName = store.get('room');
    this.initiator = false;
  }

  connect = () => {
    this.socket.on('connect', () => {
      store.set('socketId', this.socket.id);
    })
    this.socket.on('initConnections', this.initConnections)
    this.socket.on('offer', this.handleReceivedOffer);
    this.socket.on('answer', this.handleReceivedAnswer);
    this.socket.on('candidate', this.addCandidate);
    this.socket.on('peerLeave', this.handlePeerLeaveSocket);
    this.socket.on('error', this.handleError);
  }

  initConnections = async ({peerId}) => {
    const peerConnection = this.initPeerConnection(peerId, {initiator: true});
    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true
      });
      await peerConnection.setLocalDescription(offer); 
      this.send({type: "sendOffers", offer, peerId});
    } catch (e) {
      console.log("error creating offer to connect to peers", e); 
    }
  }

  handleReceivedOffer = async ({offer, offerInitiator}) => { 
    try {
      const peerConnection = this.initPeerConnection(offerInitiator, {initiator: false});
      await peerConnection.setRemoteDescription(new this._wrtc.RTCSessionDescription(offer)); 
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer); 
      this.send({type: "sendAnswer", answer, offerInitiator});
    } catch (err) {
      console.log('error receiving offer', err)
    }
  }

  initPeerConnection = (peerId, {initiator}) => {
    const peerConnection = new this._wrtc.RTCPeerConnection({ 
      "iceServers": [{
        url: 'stun:stun.l.google.com:19302'
      }],
      sdpSemantics: 'unified-plan'
    });

    addPeer(peerId, peerConnection);

    peerConnection.onicecandidate = (event) => { 
      if (Boolean(event.candidate)) { 
        this.send({type: "trickleCandidate", candidate: new this._wrtc.RTCIceCandidate(event.candidate)}); 
      } 
    };

    if (initiator) {
      const dataChannel = peerConnection.createDataChannel(store.get('room'), {reliable: true});
      peerConnection.dataChannel = this.setUpDataChannel({dataChannel, peerId});
    } else {
      peerConnection.ondatachannel = (event) => {
        setDataChannel(peerId, this.setUpDataChannel({dataChannel: event.channel, peerId}));
      }
    }

    return peerConnection
  }

  setUpDataChannel = ({dataChannel, peerId}) => {
    dataChannel.onclose = () => {
      console.log("channel close"); 
    };

    dataChannel.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.log('invalid JSON');
      };

      if (data.type === 'text') {
        renderIncomingEphemeralMessage(data.data);
      } else if (data.type === 'initPeer') {
        initPeer(data.data);
      } else if (data.type === 'updatePosition') {
        updatePeerPosition({...data.data, id: peerId})
      }
    };

    dataChannel.onopen = () => {
      dataChannel.send(JSON.stringify({
        type: 'initPeer',
        data: {
          avatar: store.get('avatar'),
          id: this.socket.id,
          ...store.get('position')
        }
      }));
    };

    dataChannel.onclose = () => {
      // this.socket.disconnect();
      // alert("you've been disconnected - please refresh to join again");
    };

    return dataChannel
  }

  handleReceivedAnswer = async ({fromSocket, answer}) => {
    const peerConnection = getPeer(fromSocket);
    await peerConnection.setRemoteDescription(new this._wrtc.RTCSessionDescription(answer)); 
  } 

  addCandidate = async ({candidate, fromSocket}) => { 
    try {
      const peerConnection = getPeer(fromSocket);
      await peerConnection.addIceCandidate(candidate); 
    } catch (e) {
      console.log('error adding received ice candidate', e)
    }
  }

  handleError = (e) => {
    console.log('error', e)
  }

  handlePeerLeaveSocket = ({leavingUser}) => {
    const peerConnection = getPeer(leavingUser)
    peerConnection.dataChannel.close();
    peerConnection.close();
    removePeer(leavingUser);
  }

  send = (data) => {
    this.socket.emit(data.type, {
      ...data, 
      fromSocket: this.socket.id,
      fromName: store.get('name')
    });
  }
}
