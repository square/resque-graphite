# resque-graphite

A process for polling Resque status from Redis and sending it to Graphite.

Global stats are available for the following metrics:

* resque.workers - number of workers (idle or otherwise).
* resque.working - number of active workers.
* resque.failing - number of unresolved failed jobs
* resque.failed - total number of failed jobs, ever.
* resque.processed - total number of processed jobs, ever.

For example, to plot the number of processed jobs over time:

```
nonNegativeDerivative(resque.processed)
```

Per-queue stats are also available. For example, for the queue "low":

* resque.low.pending - number of pending jobs.
* resque.low.working - number of active workers.

Per-host stats are also available. For example, for host1:

* host1.resque.workers - number of workers (idle or otherwise).
* host1.resque.working - number of active workers.

For example, to plot the utilization for host1:

```
divideSeries(host1.resque.working, host1.resque.workers)
```
