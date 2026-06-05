<template>
  <label class="field">
    <span class="label">{{ label }}</span>
    <div class="row">
      <span class="icon-box">
        <img v-if="iconSrc" :src="iconSrc" alt="field icon" />
        <span v-else class="icon-fallback">{{ icon }}</span>
      </span>
      <input
        :id="fieldId"
        :name="fieldName"
        :type="inputType"
        :placeholder="placeholder"
        :value="modelValue"
        :autocomplete="autocomplete"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button
        v-if="type === 'password'"
        class="toggle"
        type="button"
        @click="showPassword = !showPassword"
      >
        {{ showPassword ? '隐藏' : '显示' }}
      </button>
    </div>
    <span v-if="hint" class="hint">{{ hint }}</span>
  </label>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: string;
    id?: string;
    name?: string;
    type?: string;
    placeholder?: string;
    autocomplete?: string;
    hint?: string;
    icon?: string;
    iconSrc?: string;
  }>(),
  {
    type: 'text',
    id: '',
    name: '',
    placeholder: '',
    autocomplete: 'off',
    hint: '',
    icon: '◦',
    iconSrc: ''
  }
);

const fieldId = computed(() => props.id || 'field-' + props.label.replace(/\s+/g, '-').toLowerCase());
const fieldName = computed(() => props.name || props.autocomplete || fieldId.value);

const showPassword = ref(false);
const inputType = computed(() => {
  if (props.type !== 'password') return props.type;
  return showPassword.value ? 'text' : 'password';
});

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<style scoped>
.field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.label {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.row {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  border: 1px solid #c8d0dd;
  border-radius: 8px;
  background: #fff;
  padding: 0 10px;
}

.icon-box {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  padding: 0;
  margin-right: 8px;
  display: grid;
  place-items: center;
}

.icon-box img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.icon-fallback {
  color: #64748b;
  font-size: 14px;
}

input {
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  width: 1%;
  border: 0 !important;
  background: transparent;
  padding: 11px 0;
  min-height: 38px;
  color: #1f2937;
  font-size: 14px;
  outline: none;
  box-shadow: none !important;
  border-radius: 0 !important;
}

.toggle {
  flex: 0 0 auto;
  white-space: nowrap;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 0 0 0 8px;
  min-height: 24px;
}

.row:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}

.hint {
  color: #64748b;
  font-size: 12px;
}

@media (max-width: 640px) {
  .label {
    font-size: 15px;
  }

  input {
    font-size: 16px;
    min-height: 42px;
  }

  .toggle {
    font-size: 13px;
  }

  .hint {
    font-size: 13px;
  }
}
</style>
