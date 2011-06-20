(function() {

var $ = jQuery; // Handle namespaced jQuery

// The model that holds individual search facets and their categories.
// Held in a collection by `VS.app.searchQuery`.
VS.model.SearchFacet = Backbone.Model.extend({
  
  // Extract the category and value and serialize it in preparation for
  // turning the entire searchBox into a search query that can be sent
  // to the server for parsing and searching.
  serialize : function() {
    var category = this.get('category');
    var value    = VS.utils.inflector.trim(this.get('value'));
    
    if (!value) return '';
    
    if (!_.contains(VS.options.unquotable || [], category) && category != 'text') {
      value = '"' + value + '"';
    }
    
    if (category != 'text') {
      category = category + ': ';
    } else {
      category = "";
    }
    
    return category + value;
  }
  
});

})();