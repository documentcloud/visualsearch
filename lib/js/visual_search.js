/** @license VisualSearch.js 0.1.0
 *  (c) 2011 Samuel Clay, @samuelclay, DocumentCloud Inc.
 *  VisualSearch.js may be freely distributed under the MIT license.
 *  For all details and documentation:
 *  http://documentcloud.github.com/visualsearch
 */

(function() {
  
  // Setup VS globals. These will eventually be made instance-based.
  if (!window.VS) window.VS = {};
  if (!VS.app)    VS.app    = {};
  if (!VS.ui)     VS.ui     = {};
  if (!VS.model)  VS.model  = {};
  if (!VS.utils)  VS.utils  = {};
  
  // Entry-point used to tie all parts of VisualSearch together.
  VS.init = function(options) {
    var defaults = {
      container   : '',
      query       : '',
      unquotable  : [],
      callbacks   : {
        search          : $.noop,
        focus           : $.noop,
        categoryMatches : $.noop,
        facetMatches    : $.noop
      }
    };
    VS.options           = _.extend({}, defaults, options);
    VS.options.callbacks = _.extend({}, defaults.callbacks, options.callbacks);
    
    VS.app.hotkeys.initialize();
    VS.app.searchQuery   = new VS.model.SearchQuery();
    VS.app.searchBox     = new VS.ui.SearchBox(options);
    
    if (options.container) {
      var searchBox = VS.app.searchBox.render().el;
      $(options.container).html(searchBox);
    }
    VS.app.searchBox.value(options.query || '');
    
    // Gives the user back a reference to the `searchBox` so they 
    // can use public methods.
    return VS.app.searchBox;
  };
  
})();