// This file was recently moved from the post's show action and needs
// refactoring to become library functions. These functions handle
// the generation of Privly-Type URLs with extra options.

/**
 * Converts an associative array to an encoded string
 * for appending to the anchor.
 *
 * @param object associative_array Object to be serialized
 * @return string
 */
function hashToParameterString(associativeArray)
{
  "use strict";

  var parameterString = "";
  for (var key in associativeArray)
  {
    if( parameterString === "" )
    {
      parameterString = encodeURIComponent(key);
      parameterString += "=" + encodeURIComponent(associativeArray[key]);
    } else {
      parameterString += "&" + encodeURIComponent(key);
      parameterString += "=" + encodeURIComponent(associativeArray[key]);
    }
  }
  
  return parameterString;
}

/**
 * Converts a string to an associative array.
 *
 * @param string parameter_string String containing parameters
 * @return object
 */
function parameterStringToHash(parameterString)
{
  "use strict";

  var parameterHash = {};
  var parameterArray = parameterString.split("&");
  for (var i = 0; i < parameterArray.length; i++) {
    //var currentParameterString = decodeURIComponent(parameterArray[i]);
    var pair = parameterArray[i].split("=");
    var key = decodeURIComponent(pair[0]);
    var value = decodeURIComponent(pair[1]);
    parameterHash[key] = value;
  }

  return parameterHash;
}

/**
 * Get an associative arroy of the parameters found in the anchor
 *
 * @return object
 **/
function getParameterHash()
{
  var hashIndex = window.location.href.indexOf("#");
  if (hashIndex >= 0) {
    return parameterStringToHash(window.location.href.substring(hashIndex + 1));
  } else {
    return {};
  }
}

/**
 * Fills the link options form with the current parameter values and
 * deactivates the pre-filled parameters.
 */
function fillFormStartingValues()
{
  var currentParameters = getParameterHash();
  var elem = document.getElementById('linkFormatterForm').elements;
  for(var i = 0; i < elem.length; i++)
  {
      if(elem[i].getAttribute("use_in_url") == "true")
      {
        if (currentParameters[elem[i].name] !== undefined) {
          elem[i].value = currentParameters[elem[i].name];
          elem[i].disabled = true;
        }
      }
  }
}

/**
 * Collects the parameters from the "Link Options" sidebar and
 * assigns the newFormattedLink element to the generated URL
 */
function updateURL()
{
    "use strict";

    var parameterObject = {};
    var elem = document.getElementById('linkFormatterForm').elements;
    for(var i = 0; i < elem.length; i++)
    {
        if(elem[i].getAttribute("use_in_url") == "true")
        {
            var val = elem[i].value;
            if(! val)
                continue;
            if(elem[i].type == "checkbox" && elem[i].checked != true)
                continue;
            parameterObject[elem[i].name] = val;
        }
    }
    
    var anchorIndex = window.location.href.indexOf("#");
    if (anchorIndex < 0) {
      anchorIndex = window.location.href.length + 1;
    }
    
    var newUrl = 
      "#" +
      hashToParameterString(parameterObject);
    document.getElementById('newFormattedLink').innerHTML = newUrl;
}

/**
 * Fire an event containing the Privly URL for extensions to capture.
 * This is used in posting dialogs where the application pops up for the
 * user to create a post.
 */
function firePrivlyURLEvent(url) {
  var element = document.createElement("privlyEventSender");  
  element.setAttribute("privlyUrl", url);  
  document.documentElement.appendChild(element);  

  var evt = document.createEvent("Events");  
  evt.initEvent("PrivlyUrlEvent", true, false);  
  element.dispatchEvent(evt);
}

/**
 * Handles posted messages by checking whether they have the appropriate
 * secret. Take note that this function returns a callback, it is not the
 * callback itself.
 *
 * @param secret string the secret string that only the extension can know.
 *
 * @return a function for handling message events.
 */
function messageHandler(secret) {
  return function(message) {
    if( message.data.indexOf(secret) === 0 ) {
      var remaining = message.data.substr(secret.length);
      if ( remaining.indexOf("InitialContent") === 0 ) {
        $("#post_content").val(
          remaining.substring("InitialContent".length));
      } else if ( remaining.indexOf("Submit") === 0 ) {
        document.forms["new_post"].submit();
      }
    }
  }
}

/**
 * Send a random sequence of characters to privly-type extensions.
 * Messages containing the random sequence will be assumed to come
 * from the extensions.
 */
function firePrivlyMessageSecretEvent() {
    
  var secret = Math.random().toString(36).substring(2) + 
               Math.random().toString(36).substring(2) +  
               Math.random().toString(36).substring(2);
               
  var messageSecretElement = document.getElementById("post_content");
  if ( messageSecretElement !== undefined && 
    messageSecretElement !== null ) {
      messageSecretElement.setAttribute("privlyMessageSecret", secret);  
      var evt = document.createEvent("Event");  
      evt.initEvent("PrivlyMessageSecretEvent", true, false);  

      window.addEventListener("message", 
        messageHandler(secret),
        false);

      messageSecretElement.dispatchEvent(evt);
    }
}

/**
 * Show the form if the user has posting permission, otherwise tell the user to
 * sign in. Also adds the CSRF token to all requests.
 *
 * @param canPostCallback function the function to execute when initialization is 
 * successful.
 *
 * @param loginCallback function the function to execute if the user is not logged
 * in.
 *
 * @param cantPostLoginCallback function the function to execute if the user is logged
 * in but their user account does not have posting permission.
 *
 * @param errorCallback function the function to execute if the remote server is not
 * available.
 * 
 */
function initPrivlyService(canPostCallback, cantPostLoginCallback, loginCallback, errorCallback) {
  var csrfTokenAddress = window.location.protocol + "//" + window.location.host + "/posts/user_account_data";
  
  $.ajax({
    url: csrfTokenAddress,
    dataType: "json",
    success: function (json, textStatus, jqXHR) {
      $.ajaxSetup({
        beforeSend: function(xhr) {
          xhr.setRequestHeader('X-CSRF-Token', json.csrf);
      }});
      
      if(json.signedIn && json.canPost) {
        canPostCallback();
      } else if(json.signedIn) {
        cantPostLoginCallback();
      } else {
        loginCallback();
      }
    },
    error: function (jqXHR, textStatus, errorThrown) {
      errorCallback(jqXHR, textStatus, errorThrown);
    }
  });
}

// Initialize the communication channel
// https://github.com/privly/privly-organization/wiki/Communication-Channel
jQuery(document).ready(function(){
  //We need to give the content script time to start watching for the event
  setTimeout(function(){
      firePrivlyMessageSecretEvent();
      if ($("#javascriptEventLink").html() !== undefined && 
        $("#javascriptEventLink").html() !== "") {
        firePrivlyURLEvent($("#javascriptEventLink").html().replace(/&amp;/g, "&"));
      }
    },300);

    //show hide info about content password
    $('#content_password_info').click(function(){
        $("#info_about_content_password").toggle("slow");
    });
});
