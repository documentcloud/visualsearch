// This is the visual search facet that holds the category and its autocompleted 
// input field.
dc.ui.SearchFacet = Backbone.View.extend({
  
  type : 'facet',
  
  className : 'search_facet',
  
  events : {
    'click .category'               : 'selectFacet',
    'keydown input'                 : 'keydown',
    'mousedown input'               : 'enableEdit',
    'mouseover .cancel_search'      : 'showDelete',
    'mouseout .cancel_search'       : 'hideDelete',
    'click .cancel_search'          : 'remove'
  },
  
  initialize : function(options) {
    this.setMode('not', 'editing');
    _.bindAll(this, 'set', 'keydown', 'deselectFacet', 'deferDisableEdit');
  },
  
  render : function() {
    console.log(['search facet', this.model.get('category'), this.model.get('value')]);
    var $el = this.$el = $(this.el);
    $el.html(JST['workspace/search_facet']({
      model : this.model
    }));
    this.setMode('not', 'editing');
    this.box = this.$('input');
    this.box.val(this.model.get('value'));
    this.box.bind('blur', this.deferDisableEdit);
    this.setupAutocomplete();
    
    return this;
  },
  
  // This is defered from the searchBox so it can be attached to the 
  // DOM to get the correct font-size.
  calculateSize : function() {
    this.box.autoGrowInput();
    this.box.unbind('updated.autogrow').bind('updated.autogrow', _.bind(this.moveAutocomplete, this));
  },
  
  setupAutocomplete : function() {
    this.box.autocomplete({
      source    : _.bind(this.autocompleteValues, this),
      minLength : 0,
      delay     : 0,
      autoFocus : true,
      select    : _.bind(function(e, ui) {
        e.preventDefault();
        var originalValue = this.model.get('value');
        console.log(['autocomplete facet', ui.item.value, originalValue]);
        this.set(ui.item.value);
        if (originalValue != ui.item.value || this.box.val() != ui.item.value) this.search(e);
        return false;
      }, this)
    });
    
    this.box.autocomplete('widget').addClass('interface');
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
  
  set : function(value) {
    if (!value) return;
    // this.box.data('autocomplete').close();
    console.log(['set facet', value, this.model.get('value'), this.model]);
    this.model.set({'value': value});
  },
  
  search : function(e) {
    console.log(['facet search', e]);
    this.closeAutocomplete();
    dc.app.searchBox.searchEvent(e);
  },
  
  enableEdit : function() {
    this.canClose = false;
    console.log(['enableEdit', this.model.get('category'), this.modes.editing]);
    if (this.modes.editing != 'is') {
      this.setMode('is', 'editing');
      this.deselectFacet();
      if (this.box.val() == '') {
        this.box.val(this.model.get('value'));
      }
    }
    this.searchAutocomplete();
    this.resize();
    dc.app.searchBox.disableFacets(this);
    dc.app.searchBox.addFocus();
    if (!this.box.is(':focus')) this.box.focus();
  },
  
  deferDisableEdit : function() {
    if (!this.box.is(':focus')) return;
    this.canClose = true;
    console.log(['deferDisableEdit', this.model.get('category')]);
    _.delay(_.bind(function() {
      if (this.canClose && !this.box.is(':focus') && this.modes.editing == 'is' && this.modes.selected != 'is') {
        this.disableEdit();
      }
    }, this), 250);
  },
  
  disableEdit : function() {
    console.log(['disableEdit', this.model.get('category'), this.box.is(':focus')]);
    var newFacetQuery = dc.inflector.trim(this.box.val());
    if (newFacetQuery != this.model.get('value')) {
      this.set(newFacetQuery);
    }
    this.box.selectRange(0, 0);
    this.box.blur();
    this.setMode('not', 'editing');
    this.closeAutocomplete();
  },
  
  selectFacet : function(e, selectAll) {
    console.log(['selectFacet', this.model.get('category'), selectAll]);
    this.canClose = false;
    this.box.setCursorPosition(0);
    if (this.box.is(':focus')) this.box.blur();
    this.setMode('is', 'selected');
    this.setMode('not', 'editing');
    this.closeAutocomplete();
    if (!selectAll) {
      $(document).unbind('keydown.facet', this.keydown);
      $(document).unbind('click.facet', this.deselectFacet);
      _.defer(_.bind(function() {
        $(document).unbind('keydown.facet').bind('keydown.facet', this.keydown);
        $(document).unbind('click.facet').one('click.facet', this.deselectFacet);
      }, this));
      dc.app.searchBox.disableFacets(this);
      dc.app.searchBox.addFocus();
    }
  },
  
  deselectFacet : function() {
    console.log(['deselectFacet', this.model.get('category')]);
    if (this.modes.selected == 'is') {
      this.setMode('not', 'selected');
      this.closeAutocomplete();
    }
    $(document).unbind('keydown.facet', this.keydown);
    $(document).unbind('click.facet', this.deselectFacet);
  },
  
  searchAutocomplete : function(e) {
    // console.log(['searchAutocomplete', e]);
    var autocomplete = this.box.data('autocomplete');
    if (autocomplete) autocomplete.search();
  },
  
  closeAutocomplete : function() {
    console.log(['closeAutocomplete', this.model.get('category')]);
    var autocomplete = this.box.data('autocomplete');
    if (autocomplete) autocomplete.close();
  },

  autocompleteValues : function(req, resp) {
    var category = this.model.get('category');
    var value    = this.model.get('value');
    var matches  = [];
    var searchTerm = req.term;
    
    if (category == 'account') {
      matches = Accounts.map(function(a) { return {value: a.get('slug'), label: a.fullName()}; });
    } else if (category == 'project') {
      matches = Projects.pluck('title');
    } else if (category == 'filter') {
      matches = ['published', 'annotated'];
    } else if (category == 'access') {
      matches = ['public', 'private', 'organization'];
    } else if (category == 'title') {
      matches = _.uniq(Documents.pluck('title'));
    } else {
      // Meta data
      matches = _.compact(_.uniq(Documents.reduce(function(memo, doc) {
        if (_.size(doc.get('data'))) memo.push(doc.get('data')[category]);
        return memo;
      }, [])));
    }
    
    if (searchTerm && value != searchTerm) {
      var re = dc.inflector.escapeRegExp(searchTerm || '');
      var matcher = new RegExp('\\b' + re, 'i');
      matches = $.grep(matches, function(item) {
        return matcher.test(item) || matcher.test(item.value) || matcher.test(item.label);
      });
    }

    resp(_.sortBy(matches, function(match) {
      if (match == value || match.value == value) return '';
      else return match;
    }));
  },
  
  showDelete : function() {
    this.$el.addClass('search_facet_maybe_delete');
  },
  
  hideDelete : function() {
    this.$el.removeClass('search_facet_maybe_delete');
  },
  
  setCursorAtEnd : function(direction) {
    if (direction == -1) {
      this.box.setCursorPosition(this.box.val().length);
    } else {
      this.box.setCursorPosition(0);
    }
  },
  
  remove : function(e) {
    console.log(['remove facet', e, this.model]);
    var committed = this.model.has('value');
    this.deselectFacet();
    this.disableEdit();
    SearchQuery.remove(this.model);
    if (committed) {
      this.search();
    } else {
      dc.app.searchBox.renderFacets();
    }
    dc.app.searchBox.focusNextFacet(this, 0, {viewPosition: this.options.order});
  },
  
  removeLastCharacter : function() {
    console.log(['removeLastCharacter', this.box.val()]);
    var value = this.box.val();
    this.box.val(value.substr(0, value.length-1));
    this.resize();
  },
  
  selectText: function() {
    this.box.selectRange(0, this.box.val().length);
  },
  
  keydown : function(e) {
    var key = dc.app.hotkeys.key(e);
    console.log(['facet keydown', key, this.box.val(), this.box.getCursorPosition(), this.box.getSelection().length, dc.app.hotkeys.left, dc.app.hotkeys.right]);

    if (key == 'enter' && this.box.val()) {
      this.disableEdit();
      this.search(e);
    } else if (key == 'left') {
      if (this.box.getCursorPosition() == 0 && !this.box.getSelection().length) {
        if (this.modes.selected == 'is') {
          this.deselectFacet();
          dc.app.searchBox.focusNextFacet(this, -1, {startAtEnd: true});
        } else {
          this.selectFacet();
        }
      }
    } else if (key == 'right') {
      if (this.modes.selected == 'is') {
        e.preventDefault();
        this.deselectFacet();
        this.setCursorAtEnd(0);
        this.enableEdit(e);
      } else if (this.box.getCursorPosition() == this.box.val().length) {
        e.preventDefault();
        this.disableEdit();
        dc.app.searchBox.focusNextFacet(this, 1);
      }
    } else if (dc.app.hotkeys.shift && key == 'tab') {
      e.preventDefault();
      this.deselectFacet();
      this.disableEdit();
      dc.app.searchBox.focusNextFacet(this, -1, {startAtEnd: true, skipToFacet: true, selectText: true});
    } else if (key == 'tab') {
      e.preventDefault();
      this.deselectFacet();
      this.disableEdit();
      dc.app.searchBox.focusNextFacet(this, 1, {skipToFacet: true, selectText: true});
    } else if (dc.app.hotkeys.command && (e.which == 97 || e.which == 65)) {
      e.preventDefault();
      dc.app.searchBox.selectAllFacets();
      return false;
    } else if (dc.app.hotkeys.printable(e) && this.modes.selected == 'is') {
      dc.app.searchBox.focusNextFacet(this, -1, {startAtEnd: true});
      this.remove();
    } else if (key == 'backspace') {
      if (this.modes.selected == 'is') {
        e.preventDefault();
        this.remove(e);
      } else if (this.box.getCursorPosition() == 0 && !this.box.getSelection().length) {
        e.preventDefault();
        this.selectFacet();
      }
    }
    
    this.resize(e);
  },
  
  resize : function(e) {
    this.box.trigger('resize.autogrow', e);
  }
  
});