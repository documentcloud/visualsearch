(function() {

var $ = jQuery; // Handle namespaced jQuery

// The search box is responsible for managing the many facet views and input views.
VS.ui.SearchBox = Backbone.View.extend({
  
  id  : 'search',
  
  events : {
    'click .VS-cancel-search-box' : 'clearSearch',
    'mousedown .VS-search-box'    : 'focusSearch',
    'dblclick .VS-search-box'     : 'highlightSearch',
    'click .VS-search-box'        : 'maybeTripleClick'
  },

  // Creating a new SearchBox registers handlers for re-rendering facets when necessary,
  // as well as handling typing when a facet is selected.
  initialize : function() {
    this.flags = {
      allSelected : false
    };
    this.facetViews = [];
    this.inputViews = [];
    _.bindAll(this, 'renderFacets', '_maybeDisableFacets', 'disableFacets');
    VS.app.searchQuery.bind('refresh', this.renderFacets);
    $(document).bind('keydown', this._maybeDisableFacets);
  },

  // Renders the search box, but requires placement on the page through `this.el`.
  render : function() {
    $(this.el).append(JST['search_box']({}));
    $(document.body).setMode('no', 'search');
        
    return this;
  },
  
  // # Querying Facets #
  
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

  // Used to launch a search. Hitting enter or clicking the search button.
  searchEvent : function(e) {
    var query = this.value();
    this.focusSearch();
    if (VS.options.callbacks.search(query) !== false) {
      this.value(query);
    }
  },
  
  // # Rendering Facets #
  
  // Add a new facet. Facet will be focused and ready to accept a value. Can also
  // specify position, in the case of adding facets from an inbetween input.
  addFacet : function(category, initialQuery, position) {
    category     = VS.utils.inflector.trim(category);
    initialQuery = VS.utils.inflector.trim(initialQuery || '');
    if (!category) return;
    
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
  
  // # Modifying Facets #
  
  // Clears out the search box. Command+A + delete can trigger this, as can a cancel button.
  clearSearch : function(e) {
    this.value('');
    this.flags.allSelected = false;
    this.focusSearch(e);
  },
  
  // When setting the entire query, clear out old inputs in between facets.
  clearInputs : function() {
    _.each(this.inputViews, function(input) {
      input.clear();
    });
  },
  
  // Command+A selects all facets.
  selectAllFacets : function() {
    this.flags.allSelected = true;
    _.each(this.facetViews, function(facetView, i) {
      facetView.selectFacet();
    });
    _.each(this.inputViews, function(inputView, i) {
      inputView.selectText();
    });
    
    $(document).one('click.selectAllFacets', this.disableFacets);
  },
  
  // Used by facets and input to see if all facets are currently selected.
  allSelected : function(deselect) {
    if (deselect) this.flags.allSelected = false;
    return this.flags.allSelected;
  },
  
  // Disables all facets except for the passed in view. Used when switching between
  // facets, so as not to have to keep state of active facets.
  disableFacets : function(keepView) {
    _.each(this.inputViews, function(view) {
      if (view != keepView &&
          (view.modes.editing == 'is' || view.modes.selected == 'is')) {
        view.blur();
      }
    });
    _.each(this.facetViews, function(view) {
      if (view != keepView &&
          (view.modes.editing == 'is' || view.modes.selected == 'is')) {
        view.disableEdit();
        view.deselectFacet();
      }
    });
    
    this.flags.allSelected = false;
    this.removeFocus();
    $(document).unbind('click.selectAllFacets');
  },
  
  // Resize all inputs to account for extra keystrokes which may be changing the facet
  // width incorrectly. This is a safety check to ensure inputs are correctly sized.
  resizeFacets : function(view) {
    _.each(this.facetViews, function(facetView, i) {
      if (!view || facetView == view) {
        facetView.resize();
      }
    });
  },
  
  // Handles keydown events on the document. Used to complete the Cmd+A deletion, and
  // blurring focus.
  _maybeDisableFacets : function(e) {
    if (this.flags.allSelected && VS.app.hotkeys.key(e) == 'backspace') {
      e.preventDefault();
      this.clearSearch(e);
      return false;
    } else if (this.flags.allSelected && VS.app.hotkeys.printable(e)) {
      this.clearSearch(e);
    } else if (this.flags.allSelected) {
      this.flags.allSelected = false;
      this.disableFacets();
    }
  },
  
  
  // # Focusing Facets #
  
  // Move focus between facets and inputs. Takes a direction as well as many options
  // for skipping over inputs and only to facets, placement of cursor position in facet 
  // (i.e. at the end), and selecting the text in the input/facet.
  focusNextFacet : function(currentView, direction, options) {
    options = options || {};
    var viewCount    = this.facetViews.length;
    var viewPosition = options.viewPosition || this.viewPosition(currentView);
    
    if (!options.skipToFacet) {
      // Correct for bouncing between matching text and facet arrays.
      if (currentView.type == 'text'  && direction > 0) direction -= 1;
      if (currentView.type == 'facet' && direction < 0) direction += 1;
    } else if (options.skipToFacet && currentView.type == 'text' && 
               viewCount == viewPosition && direction >= 0) {
      // Special case of looping around to a facet from the last search input box.
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
        view.focus();
        if (options.selectText) view.selectText();
      }
    }
    if (options.selectText) view.selectText();
    this.resizeFacets();
  },

  // Bring focus to last input field.
  focusSearch : function(e, selectText) {
    var view = this.inputViews[this.inputViews.length-1];
    if (!e || 
        $(e.target).is('.VS-search-box') || 
        $(e.target).is('.search_inner') || 
        e.type == 'keydown') {
      this.disableFacets();
      if (selectText) view.focus(selectText);
      else            view.setCursorAtEnd(-1);
      if (e && e.type == 'keydown') {
        view.keydown(e);
        view.box.trigger('keydown');
      }
      _.defer(_.bind(function() {
        if (!this.$('input:focus').length) {
          this.inputViews[this.inputViews.length-1].focus(selectText);
        }
      }, this));
    }
  },
  
  // Double-clicking on the search wrapper should select the existing text in
  // the last search input. Also start the triple-click timer.
  highlightSearch : function(e) {
    var lastinput = this.inputViews[this.inputViews.length-1];
    lastinput.startTripleClickTimer();
    this.focusSearch(e, true);
  },
  
  maybeTripleClick : function(e) {
    var lastinput = this.inputViews[this.inputViews.length-1];
    return lastinput.maybeTripleClick(e);
  },
  
  // Used to show the user is focused on some input inside the search box.
  addFocus : function() {
    VS.options.callbacks.focus();
    this.$('.VS-search-box').addClass('VS-focus');
  },

  // User is no longer focused on anything in the search box.
  removeFocus : function() {
    var focus = _.any(this.facetViews.concat(this.inputViews), function(view) {
      return view.isFocused();
    });
    if (!focus) this.$('.VS-search-box').removeClass('VS-focus');
  },
  
  // Show a menu which adds pre-defined facets to the search box.
  showFacetCategoryMenu : function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.facetCategoryMenu && this.facetCategoryMenu.modes.open == 'is') {
      return this.facetCategoryMenu.close();
    }
    
    var items = [
      {title: 'Account', onClick: _.bind(this.addFacet, this, 'account', '')},
      {title: 'Project', onClick: _.bind(this.addFacet, this, 'project', '')},
      {title: 'Filter', onClick: _.bind(this.addFacet, this, 'filter', '')},
      {title: 'Access', onClick: _.bind(this.addFacet, this, 'access', '')}
    ];
    
    var menu = this.facetCategoryMenu || (this.facetCategoryMenu = new dc.ui.Menu({
      items       : items,
      standalone  : true
    }));
    
    this.$('.VS-icon-search').after(menu.render().open().content);
    return false;
  }
  
});

})();