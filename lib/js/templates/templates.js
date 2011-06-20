(function(){
window.JST = window.JST || {};

window.JST['search_box'] = _.template('<div class="VS-search">  <div id="search_container">    <div id="search_box_wrapper" class="VS-search-box">      <div class="icon search_glyph"></div>      <div class="search_inner"></div>      <div class="icon cancel_search cancel_search_box" title="clear search"></div>    </div>  </div></div>');
window.JST['search_facet'] = _.template('<% if (model.has(\'category\')) { %>  <div class="category"><%= model.get(\'category\') %>:</div><% } %><div class="search_facet_input_container">  <input type="text" class="search_facet_input VS-interface" value="" /></div><div class="search_facet_remove icon cancel_search"></div>');
window.JST['search_input'] = _.template('<input class="search_box" type="text" />');
})();