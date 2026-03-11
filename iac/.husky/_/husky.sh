#!/usr/bin/env sh
# Husky shell script for IAC directory
if [ -z "$husky_skip_init" ]; then
  # Debug function for troubleshooting
  debug() {
    if [ "$HUSKY_DEBUG" = "1" ]; then
      echo "iac-husky (debug) - $1"
    fi
  }

  readonly hook_name="$(basename -- "$0")"
  debug "Executing IAC hook: $hook_name"

  # Check if Husky is disabled
  if [ "$HUSKY" = "0" ]; then
    debug "HUSKY disabled via environment variable, skipping"
    exit 0
  fi

  # Source user configuration if available
  if [ -f ~/.huskyrc ]; then
    debug "Loading user configuration from ~/.huskyrc"
    . ~/.huskyrc
  fi

  readonly husky_skip_init=1
  export husky_skip_init
  sh -e "$0" "$@"
  exitcode="$?"

  if [ $exitcode != 0 ]; then
    echo "husky - $hook_name hook exited with code $exitcode (error)"
  fi

  if [ $exitcode = 127 ]; then
    echo "husky - command not found in PATH=$PATH"
  fi

  exit $exitcode
fi
