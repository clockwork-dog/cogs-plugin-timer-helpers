# Timer Helpers Plugin

## Overview

A plugin that extends the functionality of the adjustable timer in COGS. Adds features for triggering behaviours based on the timer hitting specific times.

## Usage

### Config

| Name                            | Value                                                                                                                                                                          | Example             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Times to report                 | A comma separated list of times to report to COGS. These should be in the same format as the timer in COGS (e.g. 01:23)                                                        | `00:00,10:00,12:34` |
| Report if skipped past          | If `On` then send reports for times that are skipped past when the timer is manually adjusted or updated via an action                                                         |                     |
| Allow multiple reports per show | If `On` then allow the same time to be reported multiple times per show. This can happen if the timer is adjusted, resulting in a previously reported time being reached again |                     |

### State

| Name        | Value                                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| Timer State | `Paused` or `Ticking`. Will update to reflect the current state of the timer. |

### Behaviours

The plugin adds a new behaviour type called `Time reached`. The `Value` should be set to the time that should trigger the behaviour. The format should be the same as used in the `Times to report` config.
