enablePlugins(ScalaJSPlugin)

name := "mak-backend"

scalaVersion := "2.11.5"

scalaJSStage in Global := FastOptStage

libraryDependencies += "org.scala-js" %%% "scalajs-dom" % "0.8.0"

scalaSource in Compile := baseDirectory.value / "scala/src"