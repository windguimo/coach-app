import { Icon } from "./Icon";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import "./InstallPrompt.css";

export function InstallPrompt() {
  const { visible, isIOS, hasNativePrompt, dismiss, promptInstall } = useInstallPrompt();

  if (!visible) return null;

  if (isIOS) {
    return (
      <div className="install-prompt">
        <div className="install-prompt__head">
          <div className="install-prompt__icon">
            <Icon name="download-simple" size={16} />
          </div>
          <div>
            <div className="install-prompt__title">Installez l'app sur votre écran d'accueil</div>
            <div className="install-prompt__text">
              Les rappels quotidiens ne fonctionnent sur iPhone que si l'app est installée — ça ne prend que 3 étapes.
            </div>
          </div>
        </div>

        <ol className="install-prompt__steps">
          <li>
            <span className="install-prompt__step-icon">
              <Icon name="export" size={15} />
            </span>
            Appuyez sur le bouton <strong>Partager</strong> de Safari
          </li>
          <li>
            <span className="install-prompt__step-icon">
              <Icon name="plus-square" size={15} />
            </span>
            Choisissez <strong>Sur l'écran d'accueil</strong>
          </li>
          <li>
            <span className="install-prompt__step-icon">
              <Icon name="check-circle" size={15} />
            </span>
            Appuyez sur <strong>Ajouter</strong>
          </li>
        </ol>

        <button className="install-prompt__dismiss" onClick={dismiss}>
          Plus tard
        </button>
      </div>
    );
  }

  if (!hasNativePrompt) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt__head">
        <div className="install-prompt__icon">
          <Icon name="download-simple" size={16} />
        </div>
        <div>
          <div className="install-prompt__title">Installez l'app</div>
          <div className="install-prompt__text">
            Accédez-y depuis votre écran d'accueil, en plein écran, avec les rappels quotidiens.
          </div>
        </div>
      </div>
      <div className="install-prompt__actions">
        <button className="btn-accent" onClick={promptInstall}>
          Installer l'app
        </button>
        <button className="install-prompt__dismiss" onClick={dismiss}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
