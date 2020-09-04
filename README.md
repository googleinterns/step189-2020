# Visualization of configuration pushes

This internship project is about a service internal to Google that is responsible for dynamically pushing pieces of configuration or data to running processes.

The two main questions this project tries to address are:

1. how do the start and end of all pushes in a push def line up against each other?
2. how does a current push compare against previous pushes?

## Terminology

A _push definition_ (push def) describes a particular push. The most relevant information for this project is that a push def describes how a push is split in several stages. At Google the push defs are organized in a tree hierarchy but, for simplicity, in this project we only used a flat list of push defs.

Each push for a particular push def is identified by a _push handle_. The handle is composed by joining the name for the push def with a _push ID_.

For each push there is a _push info_ that describes what happened during a particular push. This includes information about when the push started and when the transition from one stage+state to the next happened.

A push is split in several _stages_, with each stage updating only a subset of the consumers. Each stage also has an _attempt_ counter associated with it because a stage can be retried several times.

Each stage can go through several _states_ before completing.

## Timeline

TODO

## Bar chart

The bar chart is a visulization element that helps with the second major question when the number of pushes is not very large. It features a boxplot that allows user to compare the current push to the previous ones.
It shows a default number of most recent pushes when the user enters the page. 

The bar chart includes several interactive features: a selector to slide and select any portion to display, a drop down menu to switch between all pushes and completed pushes, and a tooltip that shows push information when the user hovers on a bar or the empty area above it.  

### Featured box plot

 The bar chart also features a box plot that allows the user to compare the current push duration to the previous pushes and helps the user predict the completion time of an ongoing push. The box plot has five labels that show the minimum, first quantile(25%), median, third quantile(75%), and maximum duration of the pushes appeared in the bar chart.

## CDF chart

TODO

## How to run the code locally

Two prerequisites are Node.js (v10.21.0) and npm package manager  (6.14.6). Newer versions of Node.js and npm might also work. npm is currently installed with Node.js by default.

    git clone https://github.com/googleinterns/step189-2020.git
    cd step189-2020
    npm ci
    npm run genproto
    npm run start

More commands are available to accomplish various tasks like linting and testing. See the scripts section from the package.json file.

## Running version

Latest running version: https://step189-2020.appspot.com/
