import '@testing-library/jest-dom';
import '@testing-library/jest-dom/jest-globals';

// jsdom does not implement the native dialog methods used by confirmations.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
