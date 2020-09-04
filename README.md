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

### Demo

![Timeline demo](/images/timeline.gif?raw=true "GIF of timeline")

### Description

The timeline tackles the first of our big questions: how do we compare pushes against each other? To solve this problem, we place all the pushes onto a timeline using the push’s start and end timestamps to define its corresponding length. Placing pushes side by side allows users to easily spot patterns in their push history and efficiently zero in on areas where those patterns are broken.

The intervals on the timeline are sorted by start time and optimally grouped into rows such that the maximum number of non-overlapping intervals are placed within one row. This ensures that the timeline is as vertically compact as possible. The color of an interval corresponds to the final stage of each push. Hovering over an interval produces a tooltip display with the push’s push ID, ending stage, start time, end time, and push duration (given in a human readable format).

With regards to UI design, the goal was to keep the timeline as minimal and
clean as possible while also conveying the maximum amount of data. The timeline
has standard horizontal panning and zooming, which are both limited to the given
domain. To clearly indicate hovering, the selected interval will drop in opacity
while also gaining a noticeable gray border. To combat the problem of having
miniscule pushes get lost in the sea of longer pushes, we set a thin border
around each interval such that, even when zoomed all the way out, smaller pushes
will still be visible. We also highlight the current x-position by showing a
vertical line that tracks the movement of the mouse and has a corresponding
label indicating the current x-axis value.

### Future Development

Future development of the timeline component might include new features such as a manual scrollbar for extremely long sets of pushes and a default view zoomed to _x_ number of pushes. Some nitpicks also include restricting the zoom out function such that the page does not scroll after maximum zoom out is reached, as well as potentially adding more whitespace between the border on hover to increase clarity. 

As with any design project, the timeline would also benefit hugely from user feedback. A specific concern that would be worth exploring is whether or not the zoom functionality is intuitive to users when looking at the timeline; if not, it may be beneficial to add in manual zoom buttons.

## Bar chart

TODO

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
