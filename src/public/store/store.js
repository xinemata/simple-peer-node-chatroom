class Store {
  constructor() {
    this.name = 'Anonymous'
    this.avatar = '#000';
    this.socketId = '';
    this.allowSendMessage = true;
    this.position = { x: 0, y: 0 };
    this.room = 'ephemeral';

    this.messageIndex = 0;
    this.systemMessageIndex = 0;

    this.activePositions = {};
    this.myActivePositions = {};

    this.peers = {};
  }

  set(key, val) {
    return this[key] = val;
  }

  get(key) {
    return this[key];
  }

  removePeer = (id) => {
    delete this.peers[id];
  }

  increment = (attribute) => {
    if (!isNaN(this[attribute])) {
      this[attribute] += 1;
    }
  }
}

const store = new Store();

export default store;