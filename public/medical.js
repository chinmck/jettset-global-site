(function () {
  'use strict';

  var form = document.getElementById('medicalTransferForm');
  if (!form) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;

    var status = document.getElementById('medicalFormStatus');
    if (status) {
      status.textContent = 'Thank you. This enquiry shell is not yet connected. Please call or WhatsApp the Jettset team for immediate assistance.';
      status.focus();
    }
  });
}());
