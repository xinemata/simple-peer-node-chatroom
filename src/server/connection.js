import socketIO from 'socket.io';

export default class SocketConnection {
  constructor(server) {
    this.io = socketIO(server);
    this.connectedUsers = {};
  }

  connect = () => {
    this.io.on('connection', (socket) => {
      if (Object.keys(io.sockets.connected).length > process.env.CONNECTION_LIMIT || 10) {
        socket.disconnect();
      }
      
      this.initConnections(socket);

      socket.on('sendOffers', this.handleSendOffers);
      socket.on('sendAnswer', (message) => {
        this.handleSendAnswer(socket, message)
      });
      socket.on('trickleCandidate', this.handleTrickleCandidate);
      socket.on('disconnect', () => this.handleDisconnect(socket));
    })
  }

  initConnections = (initiator) => {
    const peerIds = Object.keys(this.io.sockets.connected).filter(socketId => socketId !== initiator.id);
    peerIds.forEach((peer) => {
      this.sendConnection(initiator, {type: "initConnections", initiator: initiator.id, peer});    
    })
  }

  handleSendOffers = ({offer, fromSocket}) => {
    const peerIds = Object.keys(this.io.sockets.connected).filter(socketId => socketId !== fromSocket);
    peerIds.forEach((peerId) => {
      const connection = this.io.sockets.connected[peerId];
      this.sendConnection(connection, {type: "offer", offer, offerInitiator: fromSocket});    
    })
  }

  handleSendAnswer = (socket, {offerInitiator, answer}) => {
    const connection = this.io.sockets.connected[offerInitiator];   
    if(Boolean(connection)){ 
      this.sendConnection(connection, {type: "answer", answer, fromSocket: socket.id}); 
    }
  }

  handleTrickleCandidate = ({fromSocket, candidate}) => {
    const peerIds = Object.keys(this.io.sockets.connected).filter(socketId => socketId !== fromSocket)

    peerIds.forEach((peerId) => {
      const connection = this.io.sockets.connected[peerId];
      this.sendConnection(connection, {type: "candidate", candidate, fromSocket}); 
    })
  }

  handleDisconnect = ({id: leavingUser}) => {
    const peerIds = Object.keys(this.io.sockets.connected).filter(socketId => socketId !== leavingUser)

    peerIds.forEach((peerId) => {
      const connection = this.io.sockets.connected[peerId];
      this.sendConnection(connection, {type: "leave", leavingUser}); 
    })
  }

  sendConnection = (socket, message) => {
    Boolean(socket) && socket.emit(message.type, message);
  }
}