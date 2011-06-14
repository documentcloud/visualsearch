// This is the visual search input that is responsible for creating new facets.
// There is one input placed in between all facets.
VS.ui.SearchInput = Backbone.View.extend({

  type : 'text',
  
  className : 'search_input',
  
  events : {
    'keypress input'            : 'keypress',
    'keydown input'             : 'keydown'
  },
  
  initialize : function() {
    _.bindAll(this, 'removeFocus', 'addFocus', 'moveAutocomplete');
  },
  
  render : function() {
    $(this.el).html(JST['search_input']({}));
    
    this.box = this.$('input');
    this.box.autoGrowInput();
    this.box.bind('updated.autogrow', this.moveAutocomplete);
    this.box.bind('blur',  this.removeFocus);
    this.box.bind('focus', this.addFocus);
    this.setupAutocomplete();
    
    return this;
  },
  
  setupAutocomplete : function() {
    this.box.autocomplete({
      minLength : 1,
      delay     : 50,
      autoFocus : true,
      source    : _.bind(this.autocompleteValues, this),
      select    : _.bind(function(e, ui) {
        console.log(['select autocomplete', e, ui]);
        e.preventDefault();
        e.stopPropagation();
        var remainder = this.addTextFacetRemainder(ui.item.value);
        VS.app.searchBox.addFacet(ui.item.value, '', this.options.position + (remainder?1:0));
        this.clear();
        return false;
      }, this)
    });
    
    this.box.data('autocomplete')._renderMenu = function(ul, items) {
      // Renders the results under the categories they belong to.
      var category = '';
      _.each(items, _.bind(function(item, i) {
        if (item.category && item.category != category) {
          ul.append('<li class="ui-autocomplete-category">' + item.category + '</li>');
          category = item.category;
        }
        this._renderItem(ul, item);
      }, this));
    };
    
    this.box.autocomplete('widget').addClass('interface');
  },
  
  autocompleteValues : function(req, resp) {
    var searchTerm = req.term;
    var lastWord   = searchTerm.match(/\w+$/); // Autocomplete only last word.
    var re         = VS.utils.inflector.escapeRegExp(lastWord && lastWord[0] || ' ');
    var prefixes   = VS.options.callbacks.categoryMatches() || [];
        
    // Only match from the beginning of the word.
    var matcher    = new RegExp('^' + re, 'i');
    var matches    = $.grep(prefixes, function(item) {
      return matcher.test(item.label);
    });

    resp(_.sortBy(matches, function(match) {
      return match.category + '-' + match.label;
    }));
  },
  
  moveAutocomplete : function() {
    var autocomplete = this.box.data('autocomplete');
    if (autocomplete) {
      autocomplete.menu.element.position({
        my: "left top",
        at: "left bottom",
        of: this.box.data('autocomplete').element,
        collision: "none"
      });
    }
  },
  
  closeAutocomplete : function() {
    var autocomplete = this.box.data('autocomplete');
    if (autocomplete) autocomplete.close();
  },
  
  addTextFacetRemainder : function(facetValue) {
    var boxValue = this.box.val();
    var lastWord = boxValue.match(/\b(\w+)$/);
    if (lastWord && facetValue.indexOf(lastWord[0]) == 0) boxValue = boxValue.replace(/\b(\w+)$/, '');
    boxValue = boxValue.replace('^\s+|\s+$', '');
    // console.log(['addTextFacetRemainder', facetValue, lastWord, boxValue]);
    if (boxValue) {
      VS.app.searchBox.addFacet('text', boxValue, this.options.position);
    }
    return boxValue;
  },

  focus : function(selectText) {
    console.log(['input focus', selectText]);
    this.box.focus();
    if (selectText) {
      this.selectText();
    }
  },
  
  blur : function() {
    console.log(['input blur']);
    this.box.blur();
  },

  removeFocus : function(e) {
    console.log(['removeFocus', e]);
    VS.app.searchBox.removeFocus();
  },
  
  addFocus : function(e) {
    console.log(['addFocus', e]);
    VS.app.searchBox.addFocus();
  },
  
  clear : function() {
    this.box.val('');
  },
  
  value : function() {
    return this.box.val();
  },
  
  selectText : function() {
    this.box.selectRange(0, this.box.val().length);
    this.box.focus();
  },
  
  // Callback fired on key press in the search box. We search when they hit return.
  keypress : function(e) {
    var key = VS.app.hotkeys.key(e);
    console.log(['input keypress', e.keyCode, key, this.box.getCursorPosition()]);
    
    if (key == 'enter') {
      return VS.app.searchBox.searchEvent(e);
    } else if (VS.app.hotkeys.colon(e)) {
      this.box.trigger('resize.autogrow', e);
      var query    = this.box.val();
      var prefixes = VS.options.callbacks.categoryMatches() || [];
      if (_.contains(_.pluck(prefixes, 'label'), query)) {
        e.preventDefault();
        var remainder = this.addTextFacetRemainder(query);
        VS.app.searchBox.addFacet(query, '', this.options.position + (remainder?1:0));
        this.clear();
        return false;
      }
    }
  },
  
  keydown : function(e) {
    var key = VS.app.hotkeys.key(e);
    console.log(['input keydown', key, e.which, this.box.getCursorPosition()]);
    this.box.trigger('resize.autogrow', e);
    
    if (key == 'left') {
      if (this.box.getCursorPosition() == 0) {
        e.preventDefault();
        VS.app.searchBox.focusNextFacet(this, -1, {startAtEnd: true});
      }
    } else if (key == 'right') {
      if (this.box.getCursorPosition() == this.box.val().length) {
        e.preventDefault();
        VS.app.searchBox.focusNextFacet(this, 1, {selectFacet: true});
      }
    } else if (VS.app.hotkeys.shift && key == 'tab') {
      e.preventDefault();
      VS.app.searchBox.focusNextFacet(this, -1, {selectText: true});
    } else if (key == 'tab') {
      e.preventDefault();
      var value = this.box.val();
      if (value.length) {
        var remainder = this.addTextFacetRemainder(value);
        VS.app.searchBox.addFacet(value, '', this.options.position + (remainder?1:0));
      } else {
        VS.app.searchBox.focusNextFacet(this, 0, {skipToFacet: true, selectText: true});
      }
    } else if (VS.app.hotkeys.command && (e.which == 97 || e.which == 65)) {
      e.preventDefault();
      VS.app.searchBox.selectAllFacets();
      return false;
    } else if (key == 'backspace' && !VS.app.searchBox.allSelected()) {
      if (this.box.getCursorPosition() == 0 && !this.box.getSelection().length) {
        e.preventDefault();
        VS.app.searchBox.focusNextFacet(this, -1, {backspace: true});
        return false;
      }
    }
  }
  
});