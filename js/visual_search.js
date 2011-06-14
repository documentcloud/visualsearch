(function() {
  
  if (!window.VS) window.VS = {};
  if (!VS.app)    VS.app    = {};
  if (!VS.ui)     VS.ui     = {};
  if (!VS.model)  VS.model  = {};
  if (!VS.utils)  VS.utils  = {};
  
  VS.init = function(options) {
    var defaults = {
      callbacks : {
        search          : $.noop,
        focus           : $.noop,
        categoryMatches : $.noop,
        facetMatches    : $.noop
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