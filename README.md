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

TODO

## CDF chart

The CDF chart plots the fraction of the pushes with a duration less than a value vs the durations of all the pushes in the push def. This is visualized as a step plot, such that each step represents a single push. There are vertical lines indicating the 10th, 50th, and 90th percentiles to show to the user where the majority of the data lies. If the visited one push page represents a completed push, a vertical alpha channel appears at the duration value of this push so the user can see how this current push’s duration compares to the durations of all the other completed pushes in the push def. 

There is also a dot plot to show the exact values of the durations of the completed pushes in the push def. This helps show the number of completed pushes as well as visualize the distribution of the durations. Since the dot plot can be distracting at times, when there are too many dots or when it blocks the cdf chart, the user can toggle between showing and hiding the dots.

Some user interaction includes hovering and clicking. When the mouse hovers over the chart, rulers will appear to display the exact percentage and duration value of the mouse position. When the mouse clicks on the graph, the area to the left of that clicked x-value will become shaded, indicating that it is referring to the pushes with durations less than the clicked duration value. Both these features help the user better understand the CDF’s meaning.

![CDF chart](/images/final-cdf.gif?raw=true "Gif of final CDF chart")

### What did not work and what’s next

The completed CDF chart consists of only completed pushes. The open PR implements a static CDF chart with all the different end states, including completed and reverted. Each step is colored according to that push’s end state. However, because the durations of the pushes do not only depend on the end state, the colors in the graph are very distracting and do not work well together.

![CDF with all states](/images/all-states.png?raw=true "CDF with all states")

When there are too many pushes in a push def, the dots in the dot plot go off the screen. Thus, the radius of the dots should not be fixed. When there are lots of pushes, the radius of the dots should be small to accommodate all the dots. This becomes a problem when there are lots of pushes so the radius of the dots becomes too small and the user can no longer see them. One option is to adjust the height of the CDF chart when the dots are too big for the original height. This way, the CDF area plot will be expanded but the dots will stay the same size, fixing the problem that the dots go off the screen. This option still needs to be explored to see if it is viable.

To further address the question of how a current push compares to previous pushes, we want to compare an ongoing push to the previously completed push to let the user predict roughly how long it will take. While the push is in progress, a vertical line could move across the chart, starting from 0, moving to track the current time taken for the ongoing push.

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
