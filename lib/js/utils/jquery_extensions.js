(function($) {

  $.fn.extend({

    // See Backbone.View#setMode...
    setMode : function(state, group) {
      group = group || 'mode';
      var re = new RegExp("\\w+_" + group + "(\\s|$)", 'g');
      var mode = (state === null) ? "" : state + "_" + group;
      this.each(function(){
        this.className = (this.className.replace(re, '') + ' ' + mode).replace(/\s\s/g, ' ');
      });
      return mode;
    },
    
    autoGrowInput: function() {
      return this.each(function() {
        var $input = $(this);
        var $tester = $('<div />').css({
          opacity     : 0,
          top         : -9999,
          left        : -9999,
          position    : 'absolute',
          whiteSpace  : 'nowrap'
        }).addClass('input_width_tester').addClass('VS-interface');
        
        $input.after($tester);
        $input.unbind('keydown.autogrow keypress.autogrow resize.autogrow change.autogrow')
              .bind('keydown.autogrow keypress.autogrow resize.autogrow change.autogrow', function(e, realEvent) {
          if (realEvent) e = realEvent;
          var value = $input.val();
          VS.app.hotkeys.down(e);
          
          if (VS.app.hotkeys.key(e) == 'backspace') {
            var position = $input.getCursorPosition();
            if (position > 0) value = value.slice(0, position-1) + value.slice(position, value.length);              
          } else if (VS.app.hotkeys.printable(e) && !VS.app.hotkeys.command) {
            value += String.fromCharCode(e.which);
          }
          value = value.replace(/&/g, '&amp;')
                       .replace(/\s/g,'&nbsp;')
                       .replace(/</g, '&lt;')
                       .replace(/>/g, '&gt;');
          
          $tester.html(value);
          // console.log(['autoGrow', e.type, e.which, VS.app.hotkeys.printable(e), value]);
          $input.width($tester.width() + 3);
          $input.trigger('updated.autogrow');
        });
        $input.trigger('resize.autogrow');
      });
    },
    
    getCursorPosition: function() {
      var position = 0;
      var input    = this.get(0);

      if (document.selection) {
        // IE
        input.focus();
        var sel    = document.selection.createRange();
        var selLen = document.selection.createRange().text.length;
        sel.moveStart('character', -input.value.length);
        position   = sel.text.length - selLen;
      } else if (input && $(input).is(':visible') && input.selectionStart != null) {
        // Firefox/Safari
        position = input.selectionStart;
      }

      // console.log(['getCursorPosition', position]);
      return position;
    },
    
    setCursorPosition: function(position) {
      return this.each(function() {
        return $(this).selectRange(position, position);
      });
    },

    selectRange: function(start, end) {
      return this.each(function() {
        if (this.setSelectionRange) { // FF/Webkit
          this.focus();
          this.setSelectionRange(start, end);
        } else if (this.createTextRange) { // IE
          var range = this.createTextRange();
          range.collapse(true);
          range.moveEnd('character', end);
          range.moveStart('character', start);
          range.select();
        }
      });
    },
    
    getSelection: function() {
      var input = this[0];

      if (input.selectionStart != null) { // FF/Webkit
        var start = input.selectionStart;
        var end   = input.selectionEnd;
        return {start: start, end: end, length: end-start, text: input.value.substr(start, end-start)};
      } else if (document.selection) { // IE
        var range = document.selection.createRange();
        if (range) {
          var textRange = input.createTextRange();
          var copyRange = textRange.duplicate();
          textRange.moveToBookmark(range.getBookmark());
          copyRange.setEndPoint('EndToStart', textRange);
          var start = copyRange.text.length;
          var end   = start + range.text.length;
          return {start: start, end: end, length: end-start, text: range.text};
        }
      }
      return {start: 0, end: 0, length: 0};
    }
    
  });
  
})(jQuery);
    