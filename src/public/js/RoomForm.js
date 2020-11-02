import {EGALITARIAN_MODE, roomModes} from '../constants/index.js';

export default class RoomForm {
  constructor () {
    this.mode = EGALITARIAN_MODE;
    roomModes.forEach((mode) => {
      $('#meetingMode').append($('<option>').val(mode).text(mode));
    });

    $('#configureRoom').show();
  }

  initialize = () => {
  }
}