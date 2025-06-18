/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * @fileoverview Stream Management Module Handles WebRTC streaming sessions and connections.
 * @version 2.0.0
 */

/**
 * Parses JSON safely with fallback to default value.
 * @param {string} value - JSON string to parse
 * @param {*} defaultValue - Fallback value if parsing fails
 * @returns {*} Parsed value or default
 */
function safeJSONParse(value, defaultValue) {
    if (!value || value.trim() === '') {
        // For locations, return default region if empty
        if (Array.isArray(defaultValue)) {
            return ['us-east-2'];
        }
        return defaultValue;
    }
    
    try {
        const parsed = JSON.parse(value);

        // Validate the parsed data structure
        if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
            console.warn('Expected array but got different type, using default');
            return defaultValue;
        }
        
        // Ensure locations array is not empty
        if (Array.isArray(parsed) && parsed.length === 0) {
            return defaultValue;
        }
        
        return parsed;
    } catch (error) {
        console.error('JSON parsing error:', error);
        // For locations, return default region on error
        if (Array.isArray(defaultValue)) {
            return ['us-east-2'];
        }
        return defaultValue;
    }
}

/**
 * Initiates a new streaming session with WebRTC connection.
 * @async
 * @throws {Error} If connection or signal request fails
 * @returns {Promise<void>}
 */
async function appStartStreaming(isLocal) {
    try {
        // IMPORTANT: WebKit-based browsers (including all iOS browsers) require
        // audio to play immediately in response to the initial mouse click, or
        // else the browser will block the stream from auto-playing later when
        // the asynchronous stream connection process is complete. Another valid
        // workaround would be to play a "Connecting..." video, as long as the
        // video also has an audio track - even a silent audio track will do.

        if (!handleOrientation()) {
            return;
        }
        if (navigator.userAgent.indexOf(' AppleWebKit/') != -1 &&
                navigator.userAgent.indexOf(' Gecko/') == -1 &&
                navigator.userAgent.indexOf(' Chrome/') == -1) {
            window.myPreStreamAudioElement = document.createElement('audio');
            window.myPreStreamAudioElement.loop = true;
            window.myPreStreamAudioElement.src = 'silence.mp3';
            void window.myPreStreamAudioElement.play();
        }

        appShowPanel('appConnecting');

        // Disable the view metrics button
        document.getElementById("viewMetricsButton").disabled = true;

        // Play loading animation
        LoadingScreenStart();

        // Generate the signal request for a new WebRTC connection
        const signalRequest = await window.myGameLiftStreams.generateSignalRequest();

        // Get the streamGroupId based on isLocal flag
        const streamGroupId = isLocal ? document.getElementById('setupStreamGroupId').value : null;
        const setupApplicationIdValue = document.getElementById('setupApplicationId').value;
        const locations = document.getElementById('setupLocations').value;

        const token = await doPost('/api/CreateStreamSession', {
            StreamGroupId: streamGroupId,  // This will be null when isLocal is false
            ApplicationIdentifier: setupApplicationIdValue === '' ? null : setupApplicationIdValue,
            UserId: document.getElementById('setupUserId').value,
            AdditionalLaunchArgs: JSON.parse(document.getElementById('setupArgs').value || '[]'),
            AdditionalEnvironmentVariables: JSON.parse(document.getElementById('setupEnv').value || '{}'),
            SignalRequest: signalRequest,
            locations: safeJSONParse(locations),
        });
        
        // Store the application description and client CPU cores from the response
        window.applicationDescription = token.ApplicationDescription;

        // Loop of sleeping for 1 second, then polling GetSignalResponse
        // (not infinite, eventually it will succeed or doPost will throw)
        const getSignalResponseDelayMilliSec = 1000;
        let signalResponse = '';
        while (!signalResponse.length) {
            console.log('Waiting...');
            await new Promise((resolve) => { setTimeout(resolve, getSignalResponseDelayMilliSec); });
            signalResponse = (await doPost('/api/GetSignalResponse', token)).SignalResponse;
        }

        // Complete connection by forwarding signal response to GameLiftStreams object
        await window.myGameLiftStreams.processSignalResponse(signalResponse);

        LoadingScreenStop();
        
        // Now when setting query parameters, handle differently based on isLocal which is set depending on Local or Lambda deployment.
        if (isLocal) {
            setQueryParams(new Map([
                ['token', token.Token],
                ['userId', document.getElementById('setupUserId').value],
                ['streamGroupId', streamGroupId],
                ['applicationId', setupApplicationIdValue],
                ['location', JSON.parse(locations)[0]]
            ]));
        } else {
            setQueryParams(new Map([
                ['token', token.Token],
                ['userId', document.getElementById('setupUserId').value],
                ['applicationId', setupApplicationIdValue],
                ['location', JSON.parse(locations)[0]]
            ]));
        }
        appShowReconnectLinks(true);

        appShowPanel('appStreaming');

        // Check if mobile After the stream has started successfully
        if (checkIfMobile()) {
            // Attempt to go fullscreen and toggle input
            const container = document.getElementById('streamFullscreenContainer');
            container.classList.remove('streamFullscreenContainerDesktop');
            container.classList.add('streamFullscreenContainerMobile');
            appGoFullscreen();
        } else {
            const container = document.getElementById('streamFullscreenContainer');
            container.classList.remove('streamFullscreenContainerMobile');
            container.classList.add('streamFullscreenContainerDesktop');
        }

    } catch (e) {
        LoadingScreenStop();
        console.error('Failed to start streaming:', e);
        window.myGameLiftStreams.close();
        appShowPanel('appError');
    } finally {
        // Clean up the temporary looping audio element, if we created one.
        if (window.myPreStreamAudioElement) {
            window.myPreStreamAudioElement.pause();
            window.myPreStreamAudioElement.remove();
            delete window.myPreStreamAudioElement;
        }
    }
}

/**
 * Attempts to reconnect an existing streaming session.
 * @async
 * @throws {Error} If reconnection fails
 * @returns {Promise<void>}
 */
async function appReconnectStreaming() {
    const connectionToken = getQueryParams().get('token');
    try {
        appShowPanel('appConnecting');

        // Play loading animation
        LoadingScreenStart();

        // Generate the signal request for a new WebRTC connection
        const signalRequest = await window.myGameLiftStreams.generateSignalRequest();

        // Initiate the reconnection request via our backend server API
        // Unlike CreateStreamSession call which can take up to 30 seconds and requires status polling,
        // ReconnectStreamSession will return new signal response immediately on success (< 5 seconds)
        const result = await doPost('/api/ReconnectStreamSession', {
            Token: connectionToken,
            SignalRequest: signalRequest,
        });
        const signalResponse = result.SignalResponse;

        // Complete connection by forwarding signal response to GameLiftStreams object
        await window.myGameLiftStreams.processSignalResponse(signalResponse);

        LoadingScreenStop();

        appShowPanel('appStreaming');
    } catch (e) {
        LoadingScreenStop();
        console.error('Failed to reconnecting streaming:', e);
        window.myGameLiftStreams.close();
        appShowPanel('appReconnectError');
    }
}

/**
 * Safely destroys an active streaming session and collects WebRTC stats.
 * @async
 * @param {string} token - Session token to destroy
 * @returns {Promise<void>}
 */
async function endStreamSession(token) {
    // Preserve your existing stats display logic
    document.getElementById('aiWebrtcStats').style.display = 'block';
    document.getElementById('loadingIndicator').style.display = 'block';
    document.getElementById('statsContent').style.display = 'none';

    const FETCH_TIMEOUT = 30000; // 30 seconds timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
        // Get CSRF token if your app uses it
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

        const response = await fetch('/api/DestroyStreamSession', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
                'Cache-Control': 'no-cache, no-store'
            },
            body: JSON.stringify({ Token: token }),
            credentials: 'same-origin',
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Your existing stats display logic
        if (data.analysis) {
            displayWebRTCStats(data.analysis);
        } else {
            throw new Error('No analysis data received');
        }

        // Clean up resources
        if (window.myGameLiftStreams) {
            window.myGameLiftStreams.close();
        }

    } catch (error) {
        console.error('Failed to destroy session:', error);
        document.getElementById('statsContent').style.display = 'none';
        alert('An error occurred while ending the stream session. Please try again later.');
    } finally {
        clearTimeout(timeoutId);
        document.getElementById('loadingIndicator').style.display = 'none';
        
        // Clean up any remaining resources
        if (window.myPreStreamAudioElement) {
            window.myPreStreamAudioElement.pause();
            window.myPreStreamAudioElement.remove();
            delete window.myPreStreamAudioElement;
        }
    }
}

/**
 * Callback for stream connection state changes.
 * @param {string} state - Current connection state
 */
function streamConnectionStateCallback(state) {
    if (state === 'disconnected') {
        appDisconnect();
    }
}

/**
 * Handles WebRTC streaming channel errors and performs cleanup
 * 
 * @param {Error} error - The WebRTC connection error that occurred
 * @returns {void}
 * 
 * @example
 * // Usage
 * webrtcConnection.onerror = streamChannelErrorCallback;
 */
function streamChannelErrorCallback(error) {
    console.debug('WebRTC internal connection error: ' + error);
    appDisconnect();
}

/**
 * Handles server disconnect events for the streaming connection
 * 
 * @param {string} reasoncode - The reason code for the disconnect ('terminated' or other codes)
 * @returns {void}
 * 
 * @example
 * // Usage
 * connection.onDisconnect = streamServerDisconnectCallback;
 * 
 * // Example with terminated reason
 * streamServerDisconnectCallback('terminated');
 */
function streamServerDisconnectCallback(reasoncode) {
    console.debug('Server disconnected with reason: ' + reasoncode);
    if (reasoncode === 'terminated') {
        // Stream session has ended, disable all reconnection UI
        deleteAllQueryParams();
        appShowReconnectLinks(false);
    }
    // The connection state will transition to 'disconnected' within 5 seconds,
    // but there is no reason to wait. The client can disconnect immediately.
    appDisconnect();
}

/**
 * Callback function that handles messages received from the application stream
 * @param {any} message - The message received from the application
 */
function streamApplicationMessageCallback(message) {
    console.log('Received ' + message.length + ' bytes of message from Application');
}

/**
 * Terminates the application stream and handles cleanup
 */
function appTerminateStream() {
     // Check if mobile After the stream has started successfully
     if (checkIfMobile()) {
        // Attempt to go fullscreen and toggle input
        exitFullscreen();
 
        if (window.myInputEnabled) {
            appToggleInput();
        }
    }
    appDisconnect();
}

/**
 * Handles the restart operation for a stream session
 * - Retrieves connection token from query parameters
 * - Sends a request to destroy the current stream session
 * - Cleans up query parameters
 * - Reloads the page
 * @returns {boolean} Returns false to prevent default event behavior
 */
function handleRestart() {
    // Fire-and-forget a server request to terminate the stream session immediately.
    const connectionToken = getQueryParams().get('token');
    if (connectionToken) {
        void doPost('/api/DestroyStreamSession', { Token: connectionToken });
    }
    
    // Remove URL parameters first to prevent auto-reconnect
    const baseUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, baseUrl);
    
    window.location.reload();
    return false;
}

/**
 * Handles application disconnection cleanup
 * @function appDisconnect
 * @returns {void}
 */
function appDisconnect() {
    window.myGameLiftStreams.close();
    appShowPanel('appDisconnected');
    document.getElementById('disconnectedButtons').style.display = 'block'; 
 }

 /**
 * Removes all query parameters from URL
 */
 function deleteAllQueryParams() {
    const cleanPath = window.location.pathname;
    window.history.replaceState(null, null, cleanPath);
}

