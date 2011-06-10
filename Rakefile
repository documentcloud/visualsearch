require 'rubygems'
require 'jammit'

desc "Use Jammit to compile the multiple versions of Visual Search"
task :build do
  Jammit.package!
end

desc "Build the docco documentation"
task :doc do
  sh "docco js"
end
