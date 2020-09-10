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

With regards to UI design, the goal was to keep the timeline as minimal and clean as possible while also conveying the maximum amount of data. The timeline has standard horizontal panning and zooming, which are both limited to the given domain. To clearly indicate hovering, the selected interval will drop in opacity while also gaining a noticeable gray border. To combat the problem of having miniscule pushes get lost in the sea of longer pushes, we set a thin border around each interval such that, even when zoomed all the way out, smaller pushes will still be visible. We also highlight the current x-position by showing a vertical line that tracks the movement of the mouse and has a corresponding label indicating the current x-axis value.

### Future Development

Future development of the timeline component might include new features such as a manual scrollbar for extremely long sets of pushes and a default view zoomed to _x_ number of pushes. Some nitpicks also include restricting the zoom out function such that the page does not scroll after maximum zoom out is reached, as well as potentially adding more whitespace between the border on hover to increase clarity. 

As with any design project, the timeline would also benefit hugely from user feedback. A specific concern that would be worth exploring is whether or not the zoom functionality is intuitive to users when looking at the timeline; if not, it may be beneficial to add in manual zoom buttons.

## Bar chart
 
### Demo
 
![Bar Chart](/images/barchart.gif?raw=true "GIF of Bar Chart")
 
### Description
 
The bar chart is a visualization element that helps with the second major question: how does a current push compare against previous pushes, when the number of pushes is not very large? It displays the pushes in chronological order, because the pushes happened most recently are probably more important to the user. The _y_ axis of the bar chart is the duration of a single push, with the most common time unit of the pushes. The bar chart consists of a focus bar chart, a compressed bar chart with a selector, and a box plot. The focus bar chart shows a default number of pushes when the user opens the page.
 
There are several interactive features integrated in the bar chart. The user can use the selector to slide among the bars and select any portion to display. The drop down menu lets the user to switch between all pushes and completed pushes. When the user hovers on a bar or the empty area above it, the bar will be highlighted and a tooltip with the push's pushID, end state, and start time will appear on top of the bar, as well as a tag with the duration of the push.
 
### Box plot
 
The bar chart also features a box plot that allows the user to compare the current push duration to the previous pushes and helps the user predict the completion time of an ongoing push. The box plot contains five labels that show the minimum, first quantile(25%), median, third quantile(75%), and maximum duration of the pushes appeared in the focus bar chart. When the selector updates the focus bar chart or the selection of the drop down menu changes, the box plot will be updated with the new input data. When user hovers over the bar chart, the corresponding data point in the box plot will be highlighted. The points in the box plot will switch to a smaller radius to show the distribution better when there are too many data points.
 
### Future Development
 
Given the time limitation we have, there are a few possible improvements we couldn't make with the bar chart. The labels on the _x_ axis are hard to see when the bars are clustered together. They would benefit from a reformat by eliminating the common year, month and date. An improvement to the box plot is to tie the points to a fixed position, so the user will not be distracted by the animation of distributing the points every update. The other improvement we could make is with the selector by changing its color and border to make it stand out more.

## CDF chart

### Demo

![CDF chart](/images/final-cdf.gif?raw=true "GIF of final CDF chart")

### Description
The CDF chart plots the fraction of the pushes with a duration less than a value vs the durations of all the pushes in the push def. This is visualized as a step plot, such that each step represents a single push. There are dashed vertical lines indicating the 10th, 50th, and 90th percentiles to show to the user where the majority of the data lies. If the visited page represents a completed push, a vertical translucent line appears at the duration value of this push so the user can see how this current push’s duration compares to the durations of all the other completed pushes in the push def. 

There is also a dot plot to show the exact values of the durations of the completed pushes in the push def. This shows the number of completed pushes as well as visualize the distribution of the durations. Since the dot plot can be distracting at times, when there are too many dots or when it blocks the CDF chart, the user can toggle between showing and hiding the dots.

Some user interaction includes hovering and clicking. When the mouse hovers over the chart, rulers will appear to display the exact percentage and duration value of the mouse position. When the mouse clicks on the graph, the area to the left of that clicked x-value will become shaded, indicating that it is referring to the pushes with durations less than the clicked duration value. Both these features help the user better understand the CDF’s meaning.

### What did not work and what’s next

The completed CDF chart consists of only completed pushes. The open PR implements a static CDF chart with all the different end states, including completed and reverted. Each step is colored according to that push’s end state. However, because the durations of the pushes do not only depend on the end state, the colors in the graph are very distracting and do not work well together.

![CDF with all states](/images/all-states.png?raw=true "CDF with all states")

When there are too many pushes in a push def, the dots in the dot plot go off the screen. Thus, the radius of the dots should not be fixed. When there are lots of pushes, the radius of the dots should be small to accommodate all the dots. This becomes a problem when there are so many pushes that the radius of the dots becomes too small for the user to see them. One option is to adjust the height of the CDF chart when the dots are too big for the original height. This way, the CDF area plot will be expanded but the dots will stay the same size, fixing the problem that the dots go off the screen. This option still needs to be explored to see if it is viable.

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
