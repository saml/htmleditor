goog.provide('htmleditor.index');

goog.require('goog.events');
goog.require('goog.dom');
goog.require('goog.dom.ViewportSizeMonitor');
goog.require('goog.editor.Field');
goog.require('goog.style');

htmleditor.index.onWindowResize = function() {

};

htmleditor.index.start = function(editorId) {
    var viewportMonitor = new goog.dom.ViewportSizeMonitor();
    goog.events.listen(viewportMonitor, goog.events.EventType.RESIZE, function(evt) {
        var size = viewportMonitor.getSize();
        size.width -= 10;
        size.height -= 10;
        goog.style.setSize(goog.dom.getElement(editorId), size);
    });
    var editor = new goog.editor.Field(editorId);
    editor.makeEditable();
    editor.focusAndPlaceCursorAtStart();
};
