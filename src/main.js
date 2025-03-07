const { CogsConnection } = COGS;

const cogsConnection = new CogsConnection();

// Timestamps in seconds
let timerStringsToReport = [];
let reportIfSkippedPast = false;
let allowMultipleReportsPerShow = false;

// Timer state
let timerTicking = false;
let timerStartedTickingAt = 0;
let timerDurationMillis = 0;

// Timeouts keyed on the timestamp
let timeoutsReportedThisShow = new Set();
let alertTimeouts = {};

// Matches valid timer strings in the format "MM:SS"
const TIMER_STRING_REGEX = /^([1-9]\d+|0\d|[1-5]\d):([0-5]\d)$/;

function isValidTimerString(timerString) {
  return TIMER_STRING_REGEX.test(timerString);
}

// Converts a timer string in the format "MM:SS" to seconds
function timeInMillisFromTimerString(timerString) {
  // Extract minutes and seconds using a regex
  const match = timerString.match(TIMER_STRING_REGEX);

  if (match === null) {
    return undefined;
  }

  const minutes = parseInt(match[1]);
  const seconds = parseInt(match[2]);
  if (isNaN(minutes) || isNaN(seconds)) {
    return undefined;
  }

  return (minutes * 60 + seconds) * 1000;
}

function sendTimerStringAlertToCogs(timerString) {
  if (
    !timeoutsReportedThisShow.has(timerString) ||
    allowMultipleReportsPerShow
  ) {
    console.log(`Alerting for ${timerString}`);
    cogsConnection.sendEvent("Time reached", timerString);

    timeoutsReportedThisShow.add(timerString);
  }
}

function setAlertTimeouts() {
  const now = Date.now();

  // Clear previous timeouts
  if (Object.keys(alertTimeouts).length > 0) {
    // Check for timestamps that have been skipped past.
    // This can happen when the timer is manually adjusted to a new value whilst it is ticking
    if (timerTicking && reportIfSkippedPast) {
      Object.keys(alertTimeouts).forEach((timerString) => {
        const timerStringInMillis = timeInMillisFromTimerString(timerString);
        if (timerDurationMillis <= timerStringInMillis) {
          sendTimerStringAlertToCogs(timerString);
        }
      });
    }

    // If the timer has stopped, make sure to alert for any timestamps that have passed
    // This deals with the case where the timer stops at 00:00 which otherwise can cause
    // a race condition where the alert is not triggered
    if (!timerTicking) {
      Object.keys(alertTimeouts).forEach((timerString) => {
        const timerStringInMillis = timeInMillisFromTimerString(timerString);
        if (timerDurationMillis <= timerStringInMillis) {
          sendTimerStringAlertToCogs(timerString);
        }
      });
    }

    console.log("Clearing all previous timeouts");
    Object.values(alertTimeouts).forEach((timeout) => clearTimeout(timeout));
    alertTimeouts = {};
  }

  if (timerTicking && timerStringsToReport.length > 0) {
    for (const timerString of timerStringsToReport) {
      const timerStringInMillis = timeInMillisFromTimerString(timerString);
      const timeToAlert =
        timerDurationMillis -
        timerStringInMillis -
        (now - timerStartedTickingAt);

      if (timeToAlert > 0) {
        console.log(`Setting alert for ${timerString} in ${timeToAlert}ms`);

        alertTimeouts[timerString] = setTimeout(() => {
          sendTimerStringAlertToCogs(timerString);

          delete alertTimeouts[timerString];
        }, timeToAlert);
      }
    }
  }
}

function sendTimerStateToCogs() {
  cogsConnection.setState({
    "Timer State": timerTicking ? "Ticking" : "Paused",
  });
}

cogsConnection.addEventListener("config", ({ config }) => {
  // Times to report
  if (config["Times to report"] !== undefined) {
    // Unique timer strings
    timerStringsToReport = [
      ...new Set(
        config["Times to report"]
          .split(",")
          .map((x) => x.trim())
          .filter((x) => isValidTimerString(x))
      ),
    ];

    setAlertTimeouts();
  }

  // Report if skipped past
  if (config["Report if skipped past"] !== undefined) {
    reportIfSkippedPast = config["Report if skipped past"];
  }

  // Allow multiple reports per show
  if (config["Allow multiple reports per show"] !== undefined) {
    allowMultipleReportsPerShow = config["Allow multiple reports per show"];
  }
});

cogsConnection.addEventListener("message", ({ message }) => {
  // Show reset
  if (message.type === "show_reset") {
    timeoutsReportedThisShow.clear();
  }
  // Timer update
  else if (message.type === "adjustable_timer_update") {
    timerTicking = message.ticking;
    timerStartedTickingAt = timerTicking ? Date.now() : 0;
    timerDurationMillis = message.durationMillis;

    sendTimerStateToCogs();
    setAlertTimeouts();
  }
});
