import scala.scalajs.js.JSApp
import org.scalajs.dom
import dom.document

object Makgui extends JSApp {
   def main(): Unit = {
     appendPar(document.head, "gigi duru")
  }

  def appendPar(targetNode: dom.Node, text: String): Unit = {
    val parNode = document.createElement("script")
    val textNode = document.createTextNode("synch=function(){console.log('gigi');}");
    parNode.appendChild(textNode)
    targetNode.appendChild(parNode);
  }
}