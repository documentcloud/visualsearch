require 'rubygems'
require 'jammit'

desc "Use Jammit to compile the multiple versions of Visual Search"
task :build do
  $VS_MIN = false
  Jammit.package!({
    :output_folder => "build"
  })
  
  $VS_MIN = true
  Jammit.package!({
    :output_folder => "build-min"
  })
end

desc "Build the docco documentation"
task :docs do
  sh "docco public/js/*.js public/js/**/*.js"
end
