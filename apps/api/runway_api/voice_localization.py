"""Reviewed presentation templates; fact slots are copied verbatim, never calculated."""

# Long template lines keep each reviewed sentence together.
# ruff: noqa: E501

import re
from string import Formatter

from runway_api.extraction import ProviderFailure

# Slot order is deliberately identical across languages so validation can detect
# missing, repeated, reordered, or additional facts before speech synthesis.
TEMPLATES = {
    "en": {
        "summary": "As of {date}, cash is {cash}. Expected inflows are {inflows} and expected outflows are {outflows}. Projected ending cash is {balance}, with a reserve shortfall of {shortfall}. Cash runway is {runway}.",
        "days": "{days} days",
        "unbounded": "unbounded",
        "runway": " Runway uses the recorded daily net burn of {burn}. No previous snapshot is available to measure a decline.",
        "changes": " Recorded warnings: {warnings}. These belong to the demo snapshot; no live daily change feed is available.",
        "risk": " Highest recorded severity: {title}. {description}",
        "scenario": " Under the supplied scenario, projected ending cash is {balance} and the reserve shortfall is {shortfall}. {assumptions}",
    },
    "es": {
        "summary": "A fecha de {date}, el efectivo es de {cash}. Las entradas previstas son de {inflows} y las salidas previstas son de {outflows}. El saldo final previsto es de {balance}, con un déficit de reserva de {shortfall}. La autonomía de caja es de {runway}.",
        "days": "{days} días",
        "unbounded": "duración ilimitada",
        "runway": " La autonomía de caja utiliza el consumo neto diario registrado de {burn}. No hay una instantánea anterior disponible para medir una disminución.",
        "changes": " Alertas registradas: {warnings}. Pertenecen a la instantánea de demostración; no hay un flujo de cambios diarios en vivo disponible.",
        "risk": " Mayor gravedad registrada: {title}. {description}",
        "scenario": " En el escenario indicado, el saldo final previsto es de {balance} y el déficit de reserva es de {shortfall}. {assumptions}",
    },
    "fr": {
        "summary": "Au {date}, la trésorerie est de {cash}. Les encaissements prévus sont de {inflows} et les décaissements prévus sont de {outflows}. Le solde final prévu est de {balance}, avec un déficit de réserve de {shortfall}. L’autonomie de trésorerie est de {runway}.",
        "days": "{days} jours",
        "unbounded": "durée illimitée",
        "runway": " L’autonomie utilise la consommation nette quotidienne enregistrée de {burn}. Aucun état antérieur n’est disponible pour mesurer une baisse.",
        "changes": " Alertes enregistrées : {warnings}. Elles appartiennent à l’état de démonstration ; aucun flux de changements quotidiens en direct n’est disponible.",
        "risk": " Gravité enregistrée la plus élevée : {title}. {description}",
        "scenario": " Dans le scénario fourni, le solde final prévu est de {balance} et le déficit de réserve est de {shortfall}. {assumptions}",
    },
    "hi": {
        "summary": "{date} को नकदी {cash} है। अपेक्षित नकद आवक {inflows} और अपेक्षित नकद जावक {outflows} है। अनुमानित अंतिम नकदी शेष {balance} है और आरक्षित नकदी की कमी {shortfall} है। नकदी की अवधि {runway} है।",
        "days": "{days} दिन",
        "unbounded": "असीमित",
        "runway": " नकदी की अवधि दर्ज दैनिक शुद्ध नकदी खपत {burn} पर आधारित है। गिरावट मापने के लिए पिछला स्नैपशॉट उपलब्ध नहीं है।",
        "changes": " दर्ज चेतावनियाँ: {warnings}। ये डेमो स्नैपशॉट की हैं; दैनिक बदलावों की लाइव फ़ीड उपलब्ध नहीं है।",
        "risk": " दर्ज सबसे गंभीर जोखिम: {title}। {description}",
        "scenario": " दिए गए परिदृश्य में अनुमानित अंतिम नकदी शेष {balance} और आरक्षित नकदी की कमी {shortfall} है। {assumptions}",
    },
    "ar": {
        "summary": "بتاريخ {date}، يبلغ النقد المتاح {cash}. التدفقات النقدية الداخلة المتوقعة هي {inflows} والتدفقات الخارجة المتوقعة هي {outflows}. الرصيد النقدي الختامي المتوقع هو {balance}، مع عجز في الاحتياطي قدره {shortfall}. مدة كفاية النقد هي {runway}.",
        "days": "{days} يومًا",
        "unbounded": "غير محدودة",
        "runway": " تعتمد مدة كفاية النقد على صافي الاستهلاك النقدي اليومي المسجل البالغ {burn}. لا تتوفر لقطة سابقة لقياس الانخفاض.",
        "changes": " التحذيرات المسجلة: {warnings}. تنتمي إلى لقطة العرض التجريبي؛ لا تتوفر تغذية مباشرة للتغييرات اليومية.",
        "risk": " أعلى درجة خطورة مسجلة: {title}. {description}",
        "scenario": " في السيناريو المقدم، الرصيد النقدي الختامي المتوقع هو {balance} وعجز الاحتياطي هو {shortfall}. {assumptions}",
    },
}


def numeric_facts(text: str) -> list[str]:
    """Preserve exact ordered numeric tokens, including currency, signs and dates."""
    return re.findall(r"[$€£]?[+-]?\d+(?:[.,:/-]\d+)*(?:%)?", text)


def render_segment(language: str, key: str, **facts: str) -> str:
    try:
        source = TEMPLATES["en"][key]
        template = TEMPLATES[language][key]
        formatter = Formatter()
        source_slots = [
            (field, spec, conv)
            for _, field, spec, conv in formatter.parse(source)
            if field is not None
        ]
        slots = [
            (field, spec, conv)
            for _, field, spec, conv in formatter.parse(template)
            if field is not None
        ]
        if slots != source_slots:
            raise ProviderFailure("grounding_validation_failed")
        result = template.format(**facts)
        if numeric_facts(result) != numeric_facts(source.format(**facts)):
            raise ProviderFailure("grounding_validation_failed")
        return result
    except (KeyError, ValueError, IndexError) as error:
        raise ProviderFailure("grounding_validation_failed") from error
