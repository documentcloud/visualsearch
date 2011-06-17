(function() {

// DocumentCloud workspace hotkeys. To tell if a key is currently being pressed,
// just ask: `VS.app.hotkeys.control`
VS.app.hotkeys = {

  KEYS: {
    '16':  'shift',
    '17':  'control',
    '91':  'command',
    '93':  'command',
    '224': 'command',
    '13':  'enter',
    '37':  'left',
    '38':  'upArrow',
    '39':  'right',
    '40':  'downArrow',
    '46':  'delete',
    '8':   'backspace',
    '9':   'tab',
    '188': 'comma'
  },

  initialize : function() {
    _.bindAll(this, 'down', 'up', 'blur');
    $(document).bind('keydown', this.down);
    $(document).bind('keyup', this.up);
    $(window).bind('blur', this.blur);
  },

  down : function(e) {
    var key = this.KEYS[e.which];
    if (key) this[key] = true;
  },

  up : function(e) {
    var key = this.KEYS[e.which];
    if (key) this[key] = false;
  },

  blur : function(e) {
    for (var key in this.KEYS) this[this.KEYS[key]] = false;
  },
  
  key : function(e) {
    return this.KEYS[e.which];
  },
  
  colon : function(e) {
    // Colon is special, since the value is different between browsers.
    var charCode = e.which;
    return charCode && String.fromCharCode(charCode) == ":";
  },
  
  printable : function(e) {
    var code = e.which;
    if (e.type == 'keydown') {
      if (code == 32 ||                      // space
          (code >= 48 && code <= 90) ||      // 0-1a-z
          (code >= 96 && code <= 111) ||     // 0-9+-/*.
          (code >= 186 && code <= 192) ||    // ;=,-./^
          (code >= 219 && code <= 222)) {    // (\)'
        return true;
      }
    } else {
      if ((code >= 32 && code <= 126)  || // [space]!"#$%&'()*+,-.0-9:;<=>?@A-Z[\]^_`a-z{|}
          (code >= 160 && code <= 500) || // unicode
          (String.fromCharCode(code) == ":")) {
        return true;
      }      
    }
    return false;
  }

};

})();