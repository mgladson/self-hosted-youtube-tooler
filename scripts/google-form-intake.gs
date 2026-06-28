/**
 * Worker Questionnaire -> Find Care Helper intake webhook (form-bound script).
 * Paste into the Google Form's Apps Script editor (Code.gs), then:
 *   1. Project Settings (gear) -> Script properties -> add:
 *        API_URL       = https://findcarehelper.com/api
 *        INTAKE_TOKEN  = <same secret as api EMPLOYEES_INTAKE_TOKEN>
 *   2. Run installTrigger once and approve the prompts.
 */

function installTrigger() {
  var form = FormApp.getActiveForm();
  var all = ScriptApp.getProjectTriggers();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(all[i]);
    }
  }
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();
}

function onFormSubmit(e) {
  var props = PropertiesService.getScriptProperties();
  var base = props.getProperty('API_URL') || '';
  base = base.replace(/\/+$/, '');
  var token = props.getProperty('INTAKE_TOKEN') || '';
  if (!base || !token) {
    throw new Error('config missing');
  }

  var answers = {};
  var photo = null;
  var passport = null;
  var visaStamp = null;
  var entryStamp = null;
  var items = e.response.getItemResponses();
  for (var j = 0; j < items.length; j++) {
    var ir = items[j];
    var it = ir.getItem();
    if (it.getType() === FormApp.ItemType.FILE_UPLOAD) {
      var ids = ir.getResponse();
      if (ids && ids.length) {
        var b64 = encodeDriveFile_(ids[0]);
        var t = it.getTitle().toLowerCase();
        // Classify each upload by KEYWORD (robust to form-wording changes), then
        // POST it in the matching field the API already reads. Match visa/entry
        // BEFORE passport — their titles also say "...in your passport". An
        // unrecognised upload becomes the headshot if one hasn't been captured.
        if (t.indexOf('visa') !== -1) {
          if (!visaStamp) visaStamp = b64;
        } else if (t.indexOf('entry') !== -1) {
          if (!entryStamp) entryStamp = b64;
        } else if (t.indexOf('passport') !== -1) {
          if (!passport) passport = b64;
        } else if (
          t.indexOf('profile') !== -1 ||
          t.indexOf('picture') !== -1 ||
          t.indexOf('photo') !== -1 ||
          t.indexOf('headshot') !== -1
        ) {
          if (!photo) photo = b64;
        } else if (!photo) {
          photo = b64;
        }
      }
    } else {
      answers[it.getTitle()] = ir.getResponse();
    }
  }

  var payload = {
    responseId: e.response.getId(),
    respondentEmail: e.response.getRespondentEmail(),
    answers: answers,
    photoBase64: photo,
    passportBase64: passport,
    visaStampBase64: visaStamp,
    entryStampBase64: entryStamp
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Service-Token': token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var path = '/current-employees/intake';
  var res = UrlFetchApp.fetch(base + path, options);

  if (res.getResponseCode() >= 300) {
    var to = Session.getEffectiveUser().getEmail();
    MailApp.sendEmail(to, 'Intake failed', res.getContentText());
  }
}

function encodeDriveFile_(id) {
  var f = DriveApp.getFileById(id);
  return Utilities.base64Encode(f.getBlob().getBytes());
}
