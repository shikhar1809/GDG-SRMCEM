import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Award, CheckCircle2, Mail, PlusCircle, Send, Sparkles } from 'lucide-react';
import { auth, db } from '../firebase';
import { CREDENTIAL_URL } from '../utils/badgeRules';
import { createTemplateSlug, getEmailKey } from '../utils/credentialKeys';

const DEFAULT_TEMPLATE = {
  title: '',
  shortTitle: '',
  eventName: '',
  subtitle: '',
  description: '',
  tier: 'Event',
  accent: '#38bdf8',
  glow: '#2563eb',
  ribbon: '#dbeafe',
  text: '#0f172a',
};

const colorPresets = [
  { label: 'Blue', accent: '#38bdf8', glow: '#2563eb', ribbon: '#dbeafe', text: '#0f172a' },
  { label: 'Emerald', accent: '#34d399', glow: '#10b981', ribbon: '#a7f3d0', text: '#052e16' },
  { label: 'Gold', accent: '#fbbf24', glow: '#f97316', ribbon: '#fde68a', text: '#451a03' },
  { label: 'Purple', accent: '#a855f7', glow: '#7c3aed', ribbon: '#f5d0fe', text: '#2e1065' },
  { label: 'Rose', accent: '#fb7185', glow: '#e11d48', ribbon: '#ffe4e6', text: '#4c0519' },
];

const splitEmails = (value) => String(value || '')
  .split(/[\s,;]+/)
  .map(getEmailKey)
  .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

export default function AdminCredentials() {
  const [templates, setTemplates] = useState([]);
  const [templateForm, setTemplateForm] = useState(DEFAULT_TEMPLATE);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [recipientEmails, setRecipientEmails] = useState('');
  const [awardNote, setAwardNote] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'badgeTemplates'), (snap) => {
      const nextTemplates = [];
      snap.forEach((templateDoc) => {
        nextTemplates.push({ id: templateDoc.id, ...templateDoc.data() });
      });
      nextTemplates.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTemplates(nextTemplates);
      if (!selectedTemplateId && nextTemplates[0]) {
        setSelectedTemplateId(nextTemplates[0].id);
      }
    });

    return () => unsub();
  }, [selectedTemplateId]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [templates, selectedTemplateId]
  );

  const updateTemplateForm = (field, value) => {
    setTemplateForm((current) => ({ ...current, [field]: value }));
  };

  const applyPreset = (preset) => {
    setTemplateForm((current) => ({
      ...current,
      accent: preset.accent,
      glow: preset.glow,
      ribbon: preset.ribbon,
      text: preset.text,
    }));
  };

  const saveTemplate = async () => {
    const title = templateForm.title.trim();
    const eventName = templateForm.eventName.trim();

    if (!title || !eventName) {
      setStatus('Badge title and event name are required.');
      return;
    }

    setSavingTemplate(true);
    setStatus('');

    try {
      const templateId = `${createTemplateSlug(eventName)}-${createTemplateSlug(title)}`;
      const payload = {
        ...templateForm,
        title,
        eventName,
        shortTitle: templateForm.shortTitle.trim() || title.slice(0, 18),
        subtitle: templateForm.subtitle.trim() || eventName,
        description: templateForm.description.trim() || `Awarded for ${eventName}.`,
        issuer: 'GDG On Campus SRMCEM',
        active: true,
        createdBy: auth.currentUser?.email || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'badgeTemplates', templateId), payload, { merge: true });
      setTemplateForm(DEFAULT_TEMPLATE);
      setSelectedTemplateId(templateId);
      setStatus('Badge template saved.');
    } catch (error) {
      console.error('Failed to save badge template:', error);
      setStatus('Failed to save badge template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const issueBadges = async () => {
    const emails = [...new Set(splitEmails(recipientEmails))];

    if (!selectedTemplate) {
      setStatus('Select a badge template first.');
      return;
    }

    if (emails.length === 0) {
      setStatus('Enter at least one valid student Gmail address.');
      return;
    }

    setIssuing(true);
    setStatus('');

    try {
      await Promise.all(emails.map(async (email) => {
        const awardRef = doc(collection(db, 'manualCredentialBadges', email, 'badges'));
        const awardPayload = {
          badgeId: awardRef.id,
          source: 'manual',
          templateId: selectedTemplate.id,
          title: selectedTemplate.title,
          shortTitle: selectedTemplate.shortTitle,
          eventName: selectedTemplate.eventName,
          subtitle: selectedTemplate.subtitle,
          description: selectedTemplate.description,
          tier: selectedTemplate.tier,
          accent: selectedTemplate.accent,
          glow: selectedTemplate.glow,
          ribbon: selectedTemplate.ribbon,
          text: selectedTemplate.text,
          issuer: selectedTemplate.issuer || 'GDG On Campus SRMCEM',
          recipientEmail: email,
          note: awardNote.trim(),
          permanentUrl: CREDENTIAL_URL,
          issuedBy: auth.currentUser?.email || '',
          issuedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(awardRef, awardPayload);
      }));

      setRecipientEmails('');
      setAwardNote('');
      setStatus(`Issued ${emails.length} badge award${emails.length === 1 ? '' : 's'}.`);
    } catch (error) {
      console.error('Failed to issue badges:', error);
      setStatus('Failed to issue badges.');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black flex items-center gap-2 text-gray-900">
              <Award className="text-[#4285F4]" /> Credential Badge Studio
            </h2>
            <p className="text-gray-500 mt-1">
              Create reusable event badges and issue them to students by Gmail.
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 rounded-2xl text-sm font-semibold break-all">
            Student link: {CREDENTIAL_URL}
          </div>
        </div>

        {status && (
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700">
            {status}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="border border-gray-100 rounded-2xl p-5 bg-gray-50/60">
            <h3 className="text-lg font-black mb-4 flex items-center gap-2">
              <PlusCircle size={20} className="text-green-600" /> Create Badge Template
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={templateForm.eventName}
                onChange={(e) => updateTemplateForm('eventName', e.target.value)}
                placeholder="Event name"
                className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
              />
              <input
                value={templateForm.title}
                onChange={(e) => updateTemplateForm('title', e.target.value)}
                placeholder="Badge title"
                className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
              />
              <input
                value={templateForm.tier}
                onChange={(e) => updateTemplateForm('tier', e.target.value)}
                placeholder="Tier"
                className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
              />
              <input
                value={templateForm.shortTitle}
                onChange={(e) => updateTemplateForm('shortTitle', e.target.value)}
                placeholder="Short label"
                className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
              />
              <input
                value={templateForm.subtitle}
                onChange={(e) => updateTemplateForm('subtitle', e.target.value)}
                placeholder="Badge subtitle"
                className="md:col-span-2 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
              />
              <textarea
                value={templateForm.description}
                onChange={(e) => updateTemplateForm('description', e.target.value)}
                placeholder="Description shown to students"
                className="md:col-span-2 min-h-24 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Style Preset</p>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset)}
                    className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-100 rounded-full px-3 py-2 text-sm font-bold"
                  >
                    <span className="w-4 h-4 rounded-full" style={{ background: preset.accent }} />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={saveTemplate}
              disabled={savingTemplate}
              className="mt-5 w-full bg-[#34A853] hover:bg-green-600 text-white rounded-xl py-3 font-black transition-colors disabled:opacity-60"
            >
              {savingTemplate ? 'Saving Template...' : 'Save Badge Template'}
            </button>
          </section>

          <section className="border border-gray-100 rounded-2xl p-5 bg-gray-50/60">
            <h3 className="text-lg font-black mb-4 flex items-center gap-2">
              <Send size={20} className="text-purple-600" /> Give Badge To Students
            </h3>

            <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
              Badge Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-4 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Select a template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.eventName} - {template.title}
                </option>
              ))}
            </select>

            {selectedTemplate && (
              <div className="mb-4 border border-gray-200 bg-white rounded-2xl p-4 flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                  style={{ background: selectedTemplate.accent }}
                >
                  <Sparkles size={24} />
                </div>
                <div>
                  <p className="font-black text-gray-900">{selectedTemplate.title}</p>
                  <p className="text-sm text-gray-500">{selectedTemplate.eventName}</p>
                </div>
              </div>
            )}

            <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
              Student Gmail Addresses
            </label>
            <textarea
              value={recipientEmails}
              onChange={(e) => setRecipientEmails(e.target.value)}
              placeholder="student1@gmail.com, student2@gmail.com"
              className="w-full min-h-32 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <Mail size={14} /> Separate emails with commas, spaces, or new lines.
            </p>

            <textarea
              value={awardNote}
              onChange={(e) => setAwardNote(e.target.value)}
              placeholder="Optional internal note"
              className="w-full mt-4 min-h-20 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 resize-none"
            />

            <button
              onClick={issueBadges}
              disabled={issuing}
              className="mt-5 w-full bg-[#4285F4] hover:bg-blue-600 text-white rounded-xl py-3 font-black transition-colors disabled:opacity-60"
            >
              {issuing ? 'Issuing Badges...' : 'Issue Badges'}
            </button>
          </section>
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="text-xl font-black mb-4 flex items-center gap-2">
          <CheckCircle2 className="text-green-600" /> Existing Badge Templates
        </h3>
        {templates.length === 0 ? (
          <p className="text-gray-400 font-bold py-8 text-center">No badge templates yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div key={template.id} className="border border-gray-100 rounded-2xl p-4 bg-gray-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl" style={{ background: template.accent }} />
                  <div>
                    <p className="font-black text-gray-900">{template.title}</p>
                    <p className="text-xs text-gray-500">{template.eventName}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500">{template.description}</p>
                <p className="text-xs font-mono text-gray-400 mt-3 break-all">{template.id}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
