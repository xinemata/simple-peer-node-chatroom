import RoomMembership from '@js/RoomMembership';
import ArchivedMessage from '@js/ArchivedMessage';
import store from '@js/store';
import {addSystemMessage} from '@js/Togethernet/systemMessage';
import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';
import {updateMessage} from '@js/api';

class ArchivalSpace {
  static isEphemeral = false;

  constructor () {
    this.messageRecords = [];
    this.memberships = new RoomMembership('archivalSpace');

    this.editor = null;
    this.isEditingMessageId = null;

    this.$roomLink = $('#archivalSpaceLink');
  }

  initialize = () => {
    this.fetchArchivedMessages().then(() => {
      this.attachEvents();
      this.render();
    });
  };

  attachEvents = () => {
    this.$roomLink.on('click', this.goToRoom)
    $('#deleteArchivedMessage').on('click', this.markMessageDeleted)
  };

  goToRoom = () => {
    $('.chat').hide();
    $('#ephemeralSpaceActions').hide();
    this.addMember(store.getCurrentUser());
    $('#archivalSpaceActions').show();
    $('#archivalSpace').show();

    store.sendToPeers({
      type: 'joinedRoom',
      data: {
        joinedRoomId: 'archivalSpace',
      }
    });
  }

  addMember = (user) => {
    this.setEditor(user);
    this.memberships.addMember(user);
  }

  setEditor = (user) => {
    let editorProfile = user.getProfile();
    if (this.memberships.isEmpty()) {
      this.editor = editorProfile.socketId;
      addSystemMessage("You have landed in the archival channel and you are currently editing");
    } else {
      addSystemMessage(`You have landed in the archival channel and ${editorProfile.editorName} is currently editing`);
    }
    
    $('#editorOptions').find('.editorName').text(editorProfile.name);
    $('#editorOptions').find('.editorAvatar').css({backgroundColor: editorProfile.avatar});
  }

  fetchArchivedMessages = async () => {
    const response = await fetch('/archive', {
      method: 'GET',
      headers: {'Content-Type': 'application/json'},
    });

    const messageRecords = await response.json(); 
    this.messageRecords = messageRecords;
  }

  archivedMessageUpdated = ({messageData}) => {
    console.log(messageData)
    $(`#archivedMessageDetails-${messageData.id}`).find('.content').text(messageData.content);
  }

  appendArchivedMessage = ({messageData, index}) => {
    const message = new ArchivedMessage(messageData, index + 1);
    message.renderMessageRecord().appendTo($('#archivalMessagesContainer'));
    message.renderMessageDetails().appendTo($('#archivalMessagesDetailsContainer'));
  }

  appendDateHeading = (date) => {
    const $dateHeading = $('<h3></h3>');
    $dateHeading.text(date);
    $dateHeading.appendTo($('#archivalMessagesDetailsContainer'));
  }

  appendRoomHeading = (room) => {
    const $roomHeading = $('<h3></h3>');
    $roomHeading.text(room);
    $roomHeading.appendTo($('#archivalMessagesDetailsContainer'));
  }

  updateSelf = (data) => {
    const {editor, memberships} = data
    this.editor = editor;
    this.memberships.updateSelf(memberships)
  }

  groupedMessages = () => {
    const groupedMessages = {};
    const dateGroupedMessages = groupBy(this.messageRecords, (messageRecord) => {
      return new Date(messageRecord.created_at).toDateString();
    });

    sortBy(Object.keys(dateGroupedMessages), (date) => Date.parse(date)).forEach(date => {
      groupedMessages[date] = groupBy(dateGroupedMessages[date], 'room_id');
    })

    return groupedMessages;
  }

  markMessageDeleted = () => {
    if (this.isEditingMessageId && store.getCurrentUser().socketId === this.editor) {
      const content = `message deleted by ${store.getCurrentUser().getProfile().name}. ${new Date().toString()}`
      updateMessage({
        messageId: this.isEditingMessageId,
        content
      })
    }
  }

  render = () => {
    const groupedMessages = this.groupedMessages();
    Object.keys(groupedMessages).forEach(date => {
      this.appendDateHeading(date);
      const messagesByDate = groupedMessages[date];
      Object.keys(messagesByDate).forEach(roomId => {
        this.appendRoomHeading(roomId);
        messagesByDate[roomId].forEach((messageData, index) => {
          this.appendArchivedMessage({messageData, index});
        });
      });
    });
  }
}

export default ArchivalSpace;