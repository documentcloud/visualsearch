(function() {

// Model 
VS.model.SearchFacet = Backbone.Model.extend({
  
  serialize : function() {
    var category = this.get('category');
    var value    = VS.utils.inflector.trim(this.get('value'));
    
    if (!value) return '';
    
    if (!_.contains(VS.options.unquotable || [], category)) value = '"' + value + '"';
    
    if (category != 'text') {
      category = category + ': ';
    } else {
      category = "";
    }
    
    return category + value;
  }
  
});

})();