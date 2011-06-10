// The search box is responsible for managing the many facet views and input views.
dc.ui.SearchBox = Backbone.View.extend({

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
    SearchQuery.bind('refresh', this.renderFacets);
    $(document).bind('keydown', this._maybeDisableFacets);
  },

  render : function() {
    $(this.el).append(JST['workspace/search_box']({}));
    this.titleBox = this.$('#title_box_inner');
    $(document.body).setMode('no', 'search');
        
    return this;
  },

  hideSearch : function() {
    $(document.body).setMode(null, 'search');
  },

  showDocuments : function() {
    var query       = this.value();
    var title       = dc.model.DocumentSet.entitle(query);
    var projectName = SearchQuery.find('project');
    var groupName   = SearchQuery.find('group');

    $(document.body).setMode('active', 'search');
    this.titleBox.html(title);
    dc.app.organizer.highlight(projectName, groupName);
  },

  // 
  startSearch : function() {
    dc.ui.spinner.show();
    dc.app.paginator.hide();
    _.defer(dc.app.toolbar.checkFloat);
  },

  // Handles keydown events on the document. Used to complete the Cmd+A deletion, and
  // blurring focus.
  _maybeDisableFacets : function(e) {
    if (this.flags.allSelected && 
        (dc.app.hotkeys.key(e) == 'backspace' || dc.app.hotkeys.printable(e))) {
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
    console.log(['real searchEvent', e, query]);
    if (!dc.app.searcher.flags.outstandingSearch) dc.app.searcher.search(query);
    this.focusSearch();
  },
  
  // Either gets a serialized query string or sets the faceted query from a query string.
  value : function(query) {
    if (query == null) return this.getQuery();
    return this.setQuery(query);
  },
  
  // Uses the SearchQuery collection to serialize the current query from the various
  // facets that are in the search box.
  getQuery : function() {
    var query           = [];
    var inputViewsCount = this.inputViews.length;
    
    SearchQuery.each(_.bind(function(facet, i) {
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
    dc.app.SearchParser.parse(query);
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
    var model = new dc.model.SearchFacet({
      category : category,
      value    : initialQuery || ''
    });
    SearchQuery.add(model, {at: position});
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
    
    SearchQuery.each(_.bind(function(facet, i) {
      this.renderFacet(facet, i);
    }, this));
    
    // Add on an n+1 empty search input on the very end.
    this.renderSearchInput();
  },
  
  // Render a single facet, using its category and query value.
  renderFacet : function(facet, position) {
    var view = new dc.ui.SearchFacet({
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
    var input = new dc.ui.SearchInput({position: this.inputViews.length});
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
    
    var menu = this.facetCategoryMenu || (this.facetCategoryMenu = new dc.ui.Menu({
      items       : items,
      standalone  : true
    }));
    
    this.$('.search_glyph').after(menu.render().open().content);
    return false;
  },
  
  // Hide the spinner and remove the search lock when finished searching.
  doneSearching : function() {
    var count      = dc.app.paginator.query.total;
    var documents  = dc.inflector.pluralize('Document', count);
    var searchType = SearchQuery.searchType();
    
    if (dc.app.searcher.flags.related) {
      this.titleBox.text(count + ' ' + documents + ' Related to "' + dc.inflector.truncate(dc.app.searcher.relatedDoc.get('title'), 100) + '"');
    } else if (dc.app.searcher.flags.specific) {
      this.titleBox.text(count + ' ' + documents);
    } else if (searchType == 'search') {
      var quote  = SearchQuery.has('project');
      var suffix = ' in ' + (quote ? '“' : '') + this.titleBox.html() + (quote ? '”' : '');
      var prefix = count ? count + ' ' + dc.inflector.pluralize('Result', count) : 'No Results';
      this.titleBox.html(prefix + suffix);
    }
    if (count <= 0) {
      $(document.body).setMode('empty', 'search');
      var explanation = this.NO_RESULTS[searchType] || this.NO_RESULTS['search'];
      $('#no_results .explanation').text(explanation);
    }
    dc.ui.spinner.hide();
    dc.app.scroller.checkLater();
  }
  
});