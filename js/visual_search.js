(function() {
  
  if (!window.VS) window.VS = {};
  if (!VS.app)    VS.app    = {};
  if (!VS.ui)     VS.ui     = {};
  if (!VS.model)  VS.model  = {};
  if (!VS.utils)  VS.utils  = {};
  
  VS.init = function(options) {
    VS.app.hotkeys.initialize();
    VS.app.searchQuery = new VS.model.SearchQuery();
    VS.app.searchBox   = new VS.ui.SearchBox(options);
    
    var searchBox = VS.app.searchBox.render().el;
    $(options.container).html(searchBox);
    
    if (options.query != null) {
      VS.app.searchBox.value(options.query);
    }
    
    return VS.app.searchBox;
  };
  
})();