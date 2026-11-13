window.ecwActivationControls = function (container, name, allowed, generate, dialog = container) {
  const heading = document.createElement('h3');
  heading.textContent = 'Smartphone-Zugang · ' + name;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Aktivierungs- oder Rücksetzlink erstellen';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const result = document.createElement('div');
  container.append(heading, button, status, result);

  button.onclick = async () => {
    if (!allowed()) return;
    button.disabled = true;
    result.replaceChildren();
    status.textContent = 'Link wird erstellt …';
    try {
      const link = await generate();
      if (!dialog.open || !allowed()) return;
      const url = new URL(link);
      const code = new URLSearchParams(url.hash.slice(1)).get('aktivierung');
      if (url.origin !== 'https://ecwegscheid.github.io' ||
          url.pathname !== '/Vereinsverwaltung-Aktuell/smartphone-mitglieder.html' ||
          !code) throw Error('Ungültiger Link.');
      const qr = qrcode(0, 'M');
      qr.addData(url.href);
      qr.make();
      const picture = document.createElement('img');
      picture.src = qr.createDataURL(5, 20);
      picture.alt = 'Persönlicher QR-Code für ' + name;
      picture.style.cssText = 'display:block;max-width:100%;height:auto;margin:12px auto';
      const field = document.createElement('input');
      field.value = url.href;
      field.readOnly = true;
      field.setAttribute('aria-label', 'Persönlicher Link für ' + name);
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.textContent = 'Link kopieren';
      copy.onclick = async () => {
        if (!allowed()) return;
        try {
          await navigator.clipboard.writeText(field.value);
          status.textContent = 'Link kopiert.';
        } catch {
          field.focus();
          field.select();
          status.textContent = 'Link markiert. Mit Strg+C kopieren.';
        }
      };
      const codeLabel = document.createElement('label');
      codeLabel.textContent = 'Aktivierungscode';
      const codeField = document.createElement('input');
      codeField.value = code;
      codeField.readOnly = true;
      codeLabel.append(codeField);
      result.append(picture, codeLabel, field, copy);
      if (typeof navigator.share === 'function') {
        const share = document.createElement('button');
        share.type = 'button';
        share.textContent = 'Link teilen';
        share.onclick = async () => {
          if (!dialog.open || !allowed()) return;
          try {
            await navigator.share({title: 'EC Wegscheid', text: 'Dein persönlicher Link für den Smartphonezugang', url: url.href});
          } catch (error) {
            if (error.name !== 'AbortError') status.textContent = 'Teilen fehlgeschlagen. Du kannst den Link kopieren.';
          }
        };
        result.append(share);
      }
      status.textContent = 'QR-Code scannen oder den Link privat verschicken.';
    } catch (error) {
      if (dialog.open && allowed()) status.textContent = 'Link konnte nicht erstellt werden. ' + error.message;
    } finally {
      button.disabled = false;
    }
  };
};

