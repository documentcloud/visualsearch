(function() {
  
  if (!window.VS) window.VS = {};
  if (!VS.app)    VS.app    = {};
  if (!VS.ui)     VS.ui     = {};
  if (!VS.model)  VS.model  = {};
  if (!VS.utils)  VS.utils  = {};
  
  VS.init = function(options) {
    var defaults = {
      callbacks : {
        search: $.noop
      }
    };
    VS.options = _.extend({}, defaults, options);
    VS.app.hotkeys.initialize();
    VS.app.searchQuery = new VS.model.SearchQuery();
    VS.app.searchBox   = new VS.ui.SearchBox(options);
    
    if (options.container) {
      var searchBox = VS.app.searchBox.render().el;
      $(options.container).html(searchBox);
    }
    VS.app.searchBox.value(options.query || '');
    
    return VS.app.searchBox;
  };
  
})();
// The search box is responsible for managing the many facet views and input views.
VS.ui.SearchBox = Backbone.View.extend({

  // Error messages to display when your search returns no results.
  NO_RESULTS : {
    project   : "This project does not contain any documents.",
    account   : "This account does not have any documents.",
    group     : "This organization does not have any documents.",
    related   : "There are no documents related to this document.",
    published : "This account does not have any published documents.",
    annotated : "There are no annotated documents.",
    search    : "Your search did not match any documents.",
    all       : "There are no documents."
  },
  
  flags : {
    allSelected : false
  },

  id  : 'search',
  
  events : {
    'click .search_glyph'          : 'showFacetCategoryMenu',
    'click .cancel_search_box'     : 'clearSearch',
    'mousedown #search_box_wrapper': 'focusSearch',
    'dblclick #search_box_wrapper' : 'highlightSearch',
    'click #search_button'         : 'searchEvent'
  },

  // Creating a new SearchBox registers handlers for 
  initialize : function() {
    this.facetViews = [];
    this.inputViews = [];
    _.bindAll(this, 'hideSearch', 'renderFacets', '_maybeDisableFacets', 'disableFacets');
    VS.app.searchQuery.bind('refresh', this.renderFacets);
    $(document).bind('keydown', this._maybeDisableFacets);
  },

  render : function() {
    $(this.el).append(JST['search_box']({}));
    $(document.body).setMode('no', 'search');
        
    return this;
  },

  hideSearch : function() {
    $(document.body).setMode(null, 'search');
  },

  // Handles keydown events on the document. Used to complete the Cmd+A deletion, and
  // blurring focus.
  _maybeDisableFacets : function(e) {
    if (this.flags.allSelected && 
        (VS.app.hotkeys.key(e) == 'backspace' || VS.app.hotkeys.printable(e))) {
      this.clearSearch();
    } else if (this.flags.allSelected) {
      console.log(['_maybeDisableFacets', this.flags.allSelected]);
      this.flags.allSelected = false;
      this.disableFacets();
    }
  },
  
  // Clears out the search box. Command+A + delete can trigger this, as can a cancel button.
  clearSearch : function() {
    console.log(['clearSearch']);
    this.value('');
    this.flags.allSelected = false;
    this.focusSearch();
  },

  // Used to launch a search. Hitting enter or clicking the search button.
  searchEvent : function(e) {
    var query = this.value();
    console.log(['real searchEvent', e, query, VS.options.callbacks]);
    this.focusSearch();
    VS.options.callbacks.search(query);
  },
  
  // Either gets a serialized query string or sets the faceted query from a query string.
  value : function(query) {
    if (query == null) return this.getQuery();
    return this.setQuery(query);
  },
  
  // Uses the VS.app.searchQuery collection to serialize the current query from the various
  // facets that are in the search box.
  getQuery : function() {
    var query           = [];
    var inputViewsCount = this.inputViews.length;
    
    VS.app.searchQuery.each(_.bind(function(facet, i) {
      query.push(this.inputViews[i].value());
      query.push(facet.serialize());
    }, this));
    
    if (inputViewsCount) {
      query.push(this.inputViews[inputViewsCount-1].value());
    }
    console.log(['getQuery', query, _.compact(query)]);
    
    return _.compact(query).join(' ');
  },

  // Takes a query string and uses the SearchParser to parse and render it.
  setQuery : function(query) {
    this.currentQuery = query;
    VS.app.SearchParser.parse(query);
    this.clearInputs();
  },
  
  // Returns the position of a facet/input view. Useful when moving between facets.
  viewPosition : function(view) {
    var views    = view.type == 'facet' ? this.facetViews : this.inputViews;
    var position = _.indexOf(views, view);
    if (position == -1) position = 0;
    return position;
  },
  
  // ====================
  // = Rendering Facets =
  // ====================
  
  // Add a new facet. Facet will be focused and ready to accept a value. Can also
  // specify position, in the case of adding facets from an inbetween input.
  addFacet : function(category, initialQuery, position) {
    category     = dc.inflector.trim(category);
    initialQuery = dc.inflector.trim(initialQuery || '');
    if (!category) return;
    
    console.log(['addFacet', category, initialQuery, position]);
    var model = new VS.model.SearchFacet({
      category : category,
      value    : initialQuery || ''
    });
    VS.app.searchQuery.add(model, {at: position});
    this.renderFacets();
    var facetView = _.detect(this.facetViews, function(view) {
      if (view.model == model) return true;
    });
    facetView.enableEdit();
  },

  // Renders each facet as a searchFacet view.
  renderFacets : function() {
    this.facetViews = [];
    this.inputViews = [];
    
    this.$('.search_inner').empty();
    
    VS.app.searchQuery.each(_.bind(function(facet, i) {
      this.renderFacet(facet, i);
    }, this));
    
    // Add on an n+1 empty search input on the very end.
    this.renderSearchInput();
  },
  
  // Render a single facet, using its category and query value.
  renderFacet : function(facet, position) {
    var view = new VS.ui.SearchFacet({
      model : facet,
      order : position
    });
    
    // Input first, facet second.
    this.renderSearchInput();
    this.facetViews.push(view);
    this.$('.search_inner').children().eq(position*2).after(view.render().el);
    
    view.calculateSize();
    _.defer(_.bind(view.calculateSize, view));
    
    return view;
  },
  
  // Render a single input, used to create and autocomplete facets
  renderSearchInput : function() {
    var input = new VS.ui.SearchInput({position: this.inputViews.length});
    this.$('.search_inner').append(input.render().el);
    this.inputViews.push(input);
  },
  
  // When setting the entire query, clear out old inputs in between facets.
  clearInputs : function() {
    _.each(this.inputViews, function(input) {
      input.clear();
    });
  },
  
  // Move focus between facets and inputs. Takes a direction as well as many options
  // for skipping over inputs and only to facets, placement of cursor position in facet 
  // (i.e. at the end), and selecting the text in the input/facet.
  focusNextFacet : function(currentView, direction, options) {
    options = options || {};
    var viewCount    = this.facetViews.length;
    var viewPosition = options.viewPosition || this.viewPosition(currentView);
    
    console.log(['focusNextFacet', viewCount, viewPosition, currentView.type, direction, options]);
    // Correct for bouncing between matching text and facet arrays.
    if (!options.skipToFacet) {
      if (currentView.type == 'text'  && direction > 0) direction -= 1;
      if (currentView.type == 'facet' && direction < 0) direction += 1;
    } else if (options.skipToFacet && currentView.type == 'text' && 
               viewCount == viewPosition && direction >= 0) {
      viewPosition = 0;
      direction    = 0;
    }
    var view, next = Math.min(viewCount, viewPosition + direction);

    if (currentView.type == 'text' && next >= 0 && next < viewCount) {
      view = this.facetViews[next];
      if (options.selectFacet) {
        view.selectFacet();
      } else {
        view.enableEdit();
        view.setCursorAtEnd(direction || options.startAtEnd);
      }
    } else if (currentView.type == 'facet') {
      if (options.skipToFacet) {
        var view;
        if (next >= viewCount || next < 0) {
          view = _.last(this.inputViews);
          view.focus();
        } else {
          view = this.facetViews[next];
          view.enableEdit();
          view.setCursorAtEnd(direction || options.startAtEnd);
        }
      } else {
        view = this.inputViews[next];
        console.log(['next view', next, view]);
        view.focus();
        if (options.selectText) view.selectText();
      }
    }
    if (options.selectText) view.selectText();
    this.resizeFacets();
  },
  
  // Command+A selects all facets.
  selectAllFacets : function() {
    _.each(this.facetViews, function(facetView, i) {
      facetView.selectFacet(null, true);
    });
    _.each(this.inputViews, function(inputView, i) {
      inputView.selectText();
    });
    this.flags.allSelected = true;
    
    $(document).one('click', this.disableFacets);
  },
  
  // Used by facets and input to see if all facets are currently selected.
  allSelected : function() {
    return this.flags.allSelected;
  },
  
  // Disables all facets except for the passed in view. Used when switching between
  // facets, so as not to have to keep state of active facets.
  disableFacets : function(keepView) {
    _.each(this.facetViews, function(view) {
      if (view != keepView &&
          (view.modes.editing == 'is' ||
           view.modes.selected == 'is')) {
        console.log(['disabling view', view.model.get('category')]);
        view.disableEdit();
        view.deselectFacet();
      }
    });
    this.removeFocus();
  },
  
  // Resize all inputs to account for extra keystrokes which may be changing the facet
  // width incorrectly. This is a safety check to ensure inputs are correctly sized.
  resizeFacets : function() {
    _.each(this.facetViews, function(facetView, i) {
      facetView.resize();
    });
  },

  // Bring focus to last input field.
  focusSearch : function(e, selectText) {
    console.log(['focusSearch', e, !e || $(e.target).is('#search_box_wrapper') || $(e.target).is('.search_inner')]);
    if (!e || $(e.target).is('#search_box_wrapper') || $(e.target).is('.search_inner')) {
      this.disableFacets();
      _.defer(_.bind(function() {
        if (!this.$('input:focus').length) {
          this.inputViews[this.inputViews.length-1].focus(selectText);
        }
      }, this));
    }
  },
  
  // Double-clicking on the search wrapper should select the existing text in
  // the last search input.
  highlightSearch : function(e) {
    this.focusSearch(e, true);
  },
  
  // Used to show the user is focused on some input inside the search box.
  addFocus : function() {
    Documents.deselectAll();
    this.$('.search').addClass('focus');
  },

  // User is no longer focused on anything in the search box.
  removeFocus : function() {
    this.$('.search').removeClass('focus');
  },
  
  // Show a menu which adds pre-defined facets to the search box.
  showFacetCategoryMenu : function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log(['showFacetCategoryMenu', e]);
    if (this.facetCategoryMenu && this.facetCategoryMenu.modes.open == 'is') {
      return this.facetCategoryMenu.close();
    }
    
    var items = [
      {title: 'Account', onClick: _.bind(this.addFacet, this, 'account', '')},
      {title: 'Project', onClick: _.bind(this.addFacet, this, 'project', '')},
      {title: 'Filter', onClick: _.bind(this.addFacet, this, 'filter', '')},
      {title: 'Access', onClick: _.bind(this.addFacet, this, 'access', '')}
    ];
    
    var menu = this.facetCategoryMenu || (this.facetCategoryMenu = new VS.ui.Menu({
      items       : items,
      standalone  : true
    }));
    
    this.$('.search_glyph').after(menu.render().open().content);
    return false;
  }
  
});
// This is the visual search facet that holds the category and its autocompleted 
// input field.
VS.ui.SearchFacet = Backbone.View.extend({
  
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
    $el.html(JST['search_facet']({
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
    VS.app.searchBox.searchEvent(e);
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
    VS.app.searchBox.disableFacets(this);
    VS.app.searchBox.addFocus();
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
    var newFacetQuery = VS.utils.inflector.trim(this.box.val());
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
      VS.app.searchBox.disableFacets(this);
      VS.app.searchBox.addFocus();
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
      var re = VS.utils.inflector.escapeRegExp(searchTerm || '');
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
    VS.app.searchQuery.remove(this.model);
    if (committed) {
      this.search();
    } else {
      VS.app.searchBox.renderFacets();
    }
    VS.app.searchBox.focusNextFacet(this, 0, {viewPosition: this.options.order});
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
    var key = VS.app.hotkeys.key(e);
    console.log(['facet keydown', key, this.box.val(), this.box.getCursorPosition(), this.box.getSelection().length, VS.app.hotkeys.left, VS.app.hotkeys.right]);

    if (key == 'enter' && this.box.val()) {
      this.disableEdit();
      this.search(e);
    } else if (key == 'left') {
      if (this.box.getCursorPosition() == 0 && !this.box.getSelection().length) {
        if (this.modes.selected == 'is') {
          this.deselectFacet();
          VS.app.searchBox.focusNextFacet(this, -1, {startAtEnd: true});
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
        VS.app.searchBox.focusNextFacet(this, 1);
      }
    } else if (VS.app.hotkeys.shift && key == 'tab') {
      e.preventDefault();
      this.deselectFacet();
      this.disableEdit();
      VS.app.searchBox.focusNextFacet(this, -1, {startAtEnd: true, skipToFacet: true, selectText: true});
    } else if (key == 'tab') {
      e.preventDefault();
      this.deselectFacet();
      this.disableEdit();
      VS.app.searchBox.focusNextFacet(this, 1, {skipToFacet: true, selectText: true});
    } else if (VS.app.hotkeys.command && (e.which == 97 || e.which == 65)) {
      e.preventDefault();
      VS.app.searchBox.selectAllFacets();
      return false;
    } else if (VS.app.hotkeys.printable(e) && this.modes.selected == 'is') {
      VS.app.searchBox.focusNextFacet(this, -1, {startAtEnd: true});
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
// This is the visual search input that is responsible for creating new facets.
// There is one input placed in between all facets.
VS.ui.SearchInput = Backbone.View.extend({

  type : 'text',
  
  className : 'search_input',
  
  PREFIXES : [
    { label: 'project',       category: '' },
    { label: 'text',          category: '' },
    { label: 'title',         category: '' },
    { label: 'description',   category: '' },
    { label: 'source',        category: '' },
    { label: 'account',       category: '' },
    { label: 'document',      category: '' },
    { label: 'filter',        category: '' },
    { label: 'group',         category: '' },
    { label: 'access',        category: '' },
    { label: 'related',       category: '' },
    { label: 'projectid',     category: '' },
    { label: 'city',          category: 'entities' },
    { label: 'country',       category: 'entities' },
    { label: 'term',          category: 'entities' },
    { label: 'state',         category: 'entities' },
    { label: 'person',        category: 'entities' },
    { label: 'place',         category: 'entities' },
    { label: 'organization',  category: 'entities' },
    { label: 'email',         category: 'entities' },
    { label: 'phone',         category: 'entities' }
  ],

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
    var prefixes = this.PREFIXES;
    var searchTerm = req.term;
    
    var metadata = _.map(_.keys(Documents.reduce(function(memo, doc) {
      if (_.size(doc.get('data'))) _.extend(memo, doc.get('data'));
      return memo;
    }, {})), function(key) {
      return {label: key, category: 'data'};
    });
    
    prefixes = prefixes.concat(metadata);
    
    // Autocomplete only last word.
    var lastWord = searchTerm.match(/\w+$/);
    var re = VS.utils.inflector.escapeRegExp(lastWord && lastWord[0] || ' ');
    // Only match from the beginning of the word.
    var matcher = new RegExp('^' + re, 'i');
    var matches = $.grep(prefixes, function(item) {
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
      var query = this.box.val();
      if (_.contains(_.pluck(this.PREFIXES, 'label'), query)) {
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
(function(){

  // Makes the view enter a mode. Modes have both a 'mode' and a 'group',
  // and are mutually exclusive with any other modes in the same group.
  // Setting will update the view's modes hash, as well as set an HTML class
  // of *[mode]_[group]* on the view's element. Convenient way to swap styles
  // and behavior.
  Backbone.View.prototype.setMode = function(mode, group) {
    this.modes || (this.modes = {});
    if (this.modes[group] === mode) return;
    $(this.el).setMode(mode, group);
    this.modes[group] = mode;
  };

})();
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
// Naive English transformations on words.
VS.utils.inflector = {

  small : "(a|an|and|as|at|but|by|en|for|if|in|of|on|or|the|to|v[.]?|via|vs[.]?)",
	punct : "([!\"#$%&'()*+,./:;<=>?@[\\\\\\]^_`{|}~-]*)",
	
  // Only works for words that pluralize by adding an 's', end in a 'y', or
  // that we've special-cased. Not comprehensive.
  pluralize : function(s, count) {
    if (count == 1) return s;
    if (s == 'this') return 'these';
    if (s == 'person') return 'people';
    if (s == 'this') return 'these';
    if (s.match(/y$/i)) return s.replace(/y$/i, 'ies');
    return s + 's';
  },
  
  // Titleize function by John Resig after John Gruber. MIT Licensed.
	titleize : function(s) {
	  s = s.replace(/[-.\/_]/g, ' ').replace(/\s+/gm, ' ');
	  var cap = this.capitalize;
		var parts = [], split = /[:.;?!] |(?: |^)["Ò]/g, index = 0;
		while (true) {
			var m = split.exec(s);
			parts.push( s.substring(index, m ? m.index : s.length)
				.replace(/\b([A-Za-z][a-z.'Õ]*)\b/g, function(all){
					return (/[A-Za-z]\.[A-Za-z]/).test(all) ? all : cap(all);
				})
				.replace(RegExp("\\b" + this.small + "\\b", "ig"), this.lowercase)
				.replace(RegExp("^" + this.punct + this.small + "\\b", "ig"), function(all, punct, word) {
					return punct + cap(word);
				})
				.replace(RegExp("\\b" + this.small + this.punct + "$", "ig"), cap));
			index = split.lastIndex;
			if ( m ) parts.push( m[0] );
			else break;
		}
		return parts.join("").replace(/ V(s?)\. /ig, " v$1. ")
			.replace(/(['Õ])S\b/ig, "$1s")
			.replace(/\b(AT&T|Q&A)\b/ig, function(all){
				return all.toUpperCase();
			});
	},

  // Delegate to the ECMA5 String.prototype.trim function, if available.
  trim : function(s) {
    return s.trim ? s.trim() : s.replace(/^\s+|\s+$/g, '');
  },

  truncate : function(s, length, truncation) {
    length = length || 30;
    truncation = truncation == null ? '...' : truncation;
    return s.length > length ? s.slice(0, length - truncation.length) + truncation : s;
  },
  
  escapeRegExp : function(s) {
    return s.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
  }
};
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
          opacity       : 0,
          top           : -9999,
          left          : -9999,
          position      : 'absolute',
          whiteSpace    : 'nowrap'
          // height        : $input.css('height'),
          // lineHeight    : $input.css('line-height'),
          // padding       : $input.css('padding'),
          // margin        : $input.css('margin'),
          // border        : $input.css('border'),
          // fontSize      : $input.css('font-size'),
          // fontFamily    : $input.css('font-family'),
          // fontWeight    : $input.css('font-weight'),
          // fontStyle     : $input.css('font-style'),
          // letterSpacing : $input.css('letter-spacing')
        }).addClass('input_width_tester').addClass('interface');
        
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
            value += VS.app.hotkeys.shift ? 
                     String.fromCharCode(e.which) : 
                     String.fromCharCode(e.which).toLowerCase();
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
    
// A parallel partial JS implementation of lib/dc/search/parser.rb
// Used to extract keywords from the free text search.
VS.app.SearchParser = {

  ALL_FIELDS        : /('.+?'|".+?"|[^'"\s]{2}\S*):\s*('.+?'|".+?"|[^'"\s]{2}\S*)/g,
  // ALL_FIELDS        : /\w+:\s?(('.+?'|".+?")|([^'"]{2}\S*))/g,
  
  FIELD             : /(.+?):\s*/,
  
  ONE_ENTITY        : /(city|country|term|state|person|place|organization|email|phone):\s*(([^'"][^'"]\S*)|'(.+?)'|"(.+?)")/i,

  ALL_ENTITIES      : /(city|country|term|state|person|place|organization|email|phone):\s*(([^'"][^'"]\S*)|'(.+?)'|"(.+?)")/ig,

  parse : function(query) {
    var searchFacets = this.extractAllFacets(query);
    VS.app.searchQuery.refresh(searchFacets);
  },
  
  extractAllFacets : function(query) {
    var facets = [];
    var originalQuery = query;
    
    while (query) {
      var category, value;
      originalQuery = query;
      var field = this.extractNextField(query);
      if (!field) {
        category = 'text';
        value    = this.extractSearchText(query);
        query    = VS.utils.inflector.trim(query.replace(value, ''));
      } else if (field.indexOf(':') != -1) {
        category = field.match(this.FIELD)[1];
        value    = field.replace(this.FIELD, '').replace(/(^['"]|['"]$)/g, '');
        query    = VS.utils.inflector.trim(query.replace(field, ''));
      } else if (field.indexOf(':') == -1) {
        category = 'text';
        value    = field;
        query    = VS.utils.inflector.trim(query.replace(value, ''));
      }
      // console.log(['extractAllFacets', query, category, value, field]);
      if (category && value) {
          var searchFacet = new VS.model.SearchFacet({
            category : category,
            value    : VS.utils.inflector.trim(value)
          });
          facets.push(searchFacet);
      }
      if (originalQuery == query) break;
    }
    
    return facets;
  },
  
  extractNextField : function(query) {
    var textRe = /^\s*(\S+)\s+(?=\w+:\s?(('.+?'|".+?")|([^'"]{2}\S*)))/;
    var textMatch = query.match(textRe);
    console.log(['extractNextField', query, textMatch]);
    if (textMatch && textMatch.length >= 1) {
      return textMatch[1];
    } else {
      return this.extractFirstField(query);
    }
  },
  
  extractFirstField : function(query) {
    var fields = query.match(this.ALL_FIELDS);
    return fields && fields.length && fields[0];
  },
  
  extractSearchText : function(query) {
    query = query || '';
    var text = VS.utils.inflector.trim(query.replace(this.ALL_FIELDS, ''));
    console.log(['extractSearchText', query, text]);
    return text;
  },

  extractEntities : function(query) {
    var all = this.ALL_ENTITIES, one = this.ONE_ENTITY;
    var entities = query.match(all) || [];
    return _.sortBy(_.map(entities, function(ent){
      var match = ent.match(one);
      return {type : match[1], value : match[3] || match[4] || match[5]};
    }), function(ent) {
      return ent.value.toLowerCase();
    }).reverse();
  }

};
VS.model.SearchFacet = Backbone.Model.extend({
  
  UNQUOTABLE_CATEGORIES : [
    'text',
    'account',
    'document',
    'filter',
    'group',
    'access',
    'related',
    'projectid'
  ],
    
  serialize : function() {
    var category = this.get('category');
    var value    = VS.utils.inflector.trim(this.get('value'));
    
    if (!value) return '';
    
    if (!_.contains(this.UNQUOTABLE_CATEGORIES, category)) value = '"' + value + '"';
    
    if (category != 'text') {
      category = category + ': ';
    } else {
      category = "";
    }
    
    return category + value;
  }
  
});
VS.model.SearchQuery = Backbone.Collection.extend({
  
  model : VS.model.SearchFacet,
  
  value : function() {
    return this.map(function(facet) {
      return facet.serialize();
    }).join(' ');
  },
  
  find : function(category) {
    var facet = this.detect(function(facet) {
      return facet.get('category') == category;
    });
    return facet && facet.get('value');
  },
  
  count : function(category) {
    return this.select(function(facet) {
      return facet.get('category') == category;
    }).length;
  },
  
  values : function(category) {
    var facets = this.select(function(facet) {
      return facet.get('category') == category;
    });
    return _.map(facets, function(facet) { return facet.get('value'); });
  },
  
  has : function(category, value) {
    return this.any(function(facet) {
      if (value) {
        return facet.get('category') == category && facet.get('value') == value;
      } else {
        return facet.get('category') == category;
      }
    });
  },
  
  searchType : function() {
    var single   = false;
    var multiple = false;
    
    this.each(function(facet) {
      var category = facet.get('category');
      var value    = facet.get('value');
      
      if (value) {
        if (!single && !multiple) {
          single = category;
        } else {
          multiple = true;
          single = false;
        }
      }
    });

    if (single == 'filter') {
      return this.get('value');
    } else if (single == 'projectid') {
      return 'project';
    } else if (_.contains(['project', 'group', 'account'], single)) {
      return single;
    } else if (!single && !multiple) {
      return 'all';
    }
    
    return 'search';
  },
  
  withoutCategory : function(category) {
    var query = this.map(function(facet) {
      if (facet.get('category') != category) return facet.serialize();
    }).join(' ');
    
    return query;
  }
    
});(function(){
window.JST = window.JST || {};

window.JST['search_box'] = _.template('<div class="VS-search">  <div id="search_container">    <div id="search_button" class="minibutton">Search</div>    <div id="search_box_wrapper" class="text_input search noselect">      <div class="icon search_glyph"></div>      <div class="search_inner"></div>      <div class="icon cancel_search cancel_search_box" title="clear search"></div>    </div>  </div></div>');
window.JST['search_facet'] = _.template('<% if (model.has(\'category\')) { %>  <div class="category"><%= model.get(\'category\') %>:</div><% } %><div class="search_facet_input_container">  <input type="text" class="search_facet_input interface" value="" /></div><div class="search_facet_remove icon cancel_search"></div>');
window.JST['search_input'] = _.template('<input class="search_box" type="text" />');
})();